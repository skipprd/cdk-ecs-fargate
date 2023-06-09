import {RemovalPolicy, Stack, StackProps, Tags, Duration} from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import {SecurityGroup, SubnetType} from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import {FargatePlatformVersion} from '@aws-cdk/aws-ecs';
import * as efs from '@aws-cdk/aws-efs';
import {ISecret} from '@aws-cdk/aws-secretsmanager';
import {LogGroup, LogStream, RetentionDays} from '@aws-cdk/aws-logs';
import {Effect, PolicyStatement, Role, ServicePrincipal,} from '@aws-cdk/aws-iam';
import {Bucket} from "@aws-cdk/aws-s3";

export interface SkipprProps extends StackProps {

    readonly env: {
        readonly region: string;
        readonly account: string;
    };
    readonly logicalName: string;

    // Shared Infra (VPC, ECS Cluster, IAM Role, Elastic File System, etc)
    readonly vpc: ec2.IVpc;
    readonly ecsCluster: ecs.Cluster;
    readonly ingestionSecuirtyGroup: SecurityGroup;
    readonly datalakeBucket: Bucket;
    readonly efsSecurityGroup: SecurityGroup;

    // Ingest Job Config
    readonly skipprVersion: string;
    readonly schemaOutputGlueDatabaseName: string;
    readonly schemaOutputPluginName: string;
    readonly outputAthenaWorkgroupName: string;
    readonly outputPluginName: string;
    readonly transformBatchPartitionFieldNames: string;
    readonly bufferThresholdSeconds: string;
    readonly bufferThresholdBytes: string;
    readonly sourceBatchSizeBytes: string;
    readonly sourcePluginName: string;
    readonly pipelineName: string;
    readonly outputS3Prefix: string;
    readonly sourceS3Prefix: string;
    readonly sourceS3Bucket: string;
    readonly transformFlattenEvents: string;
    readonly transformNamespaceFieldNames: string;
    readonly transformBatchTimeFieldNames: string;
    readonly transformBatchTimeUnit: string;
    // readonly skipprApiKeySecret: ISecret;
    readonly skipprApiKey: string;
}

export class SkipprStack extends Stack {
    constructor(scope: Stack, id: string, props: SkipprProps) {
        super(scope, id, props);

        const logGroup = new LogGroup(scope, `${props.logicalName.toLowerCase()}-${props.pipelineName}-skippr-log-group`, {
            logGroupName: `data-warehouse-${props.pipelineName}`,
            retention: RetentionDays.TWO_WEEKS,
            removalPolicy: RemovalPolicy.DESTROY,
        });
        Tags.of(logGroup).add('Component', 'Skippr Jobs');

        const skipprIngestStream = new LogStream(
            scope,
            `${props.pipelineName}-skippr-ingest-log-stream`,
            {
                logGroup: logGroup,
                removalPolicy: RemovalPolicy.DESTROY,
            }
        );
        Tags.of(skipprIngestStream).add('Component', 'Skippr Ingest Jobs');

        const skipprIngestRole = new Role(scope, `${props.logicalName.toLowerCase()}-${props.pipelineName}-skippr-ingest-role`, {
            assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
            roleName: `${props.pipelineName}-skippr-ingest-role`,
        });
        Tags.of(skipprIngestRole).add('Component', 'Skippr Ingest Jobs');

        skipprIngestRole.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                resources: ["arn:aws:logs:*:*:*"],
                actions: [
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents"
                ],
            })
        );
        skipprIngestRole.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                resources: ["*"],
                actions: [
                    's3:ListBuckets',
                ],
            })
        );
        skipprIngestRole.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                resources: [
                    "*",
                ],
                actions: [
                    's3:ListBucket',
                    's3:ListObjectsV2',
                    's3:ListObjects',
                    's3:GetObject',
                    's3:PutObject',
                ],
            })
        );
        skipprIngestRole.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                resources: ["*"],
                actions: [
                    'athena:*',
                    'glue:*',
                ],
            })
        );
        skipprIngestRole.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                resources: ["*"],
                actions: [
                    'kms:*',
                    'ssm:GetParameters',
                ],
            })
        );
        // Optional secret for API key
        // skipprIngestRole.addToPolicy(
        //     new PolicyStatement({
        //         effect: Effect.ALLOW,
        //         resources: [
        //             props.skipprApiKeySecret.secretArn
        //         ],
        //         actions: [
        //             "secretsmanager:*"
        //         ],
        //     })
        // );

        const fileSystem = new efs.FileSystem(scope, `${props.logicalName.toLowerCase()}-${props.pipelineName}-skippr-efs`, {
            vpc: props.vpc,
            vpcSubnets: props.vpc.selectSubnets({subnetType: SubnetType.PUBLIC}),
            encrypted: true,
            lifecyclePolicy: efs.LifecyclePolicy.AFTER_7_DAYS,
            performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
            throughputMode: efs.ThroughputMode.BURSTING,
            removalPolicy: RemovalPolicy.DESTROY,
            securityGroup: props.efsSecurityGroup
        });
        Tags.of(fileSystem).add('Component', 'Ingest Buffer FS');


        const taskDef = new ecs.FargateTaskDefinition(
            scope,
            `${props.logicalName.toLowerCase()}-${props.pipelineName}-ingest-task`,
            {
                cpu: 1024,
                memoryLimitMiB: 2048,
                taskRole: skipprIngestRole,
            }
        );

        taskDef.addVolume({
            name: `efs-${props.pipelineName}`,
            efsVolumeConfiguration: {
                fileSystemId: fileSystem.fileSystemId,
                rootDirectory: "/", // '/skippr' on the actual EFS file system
            },
        });

        const ecsService = new ecs.FargateService(scope, `${props.logicalName.toLowerCase()}-${props.pipelineName}-service`, {
            cluster: props.ecsCluster,
            taskDefinition: taskDef,
            assignPublicIp: true,
            vpcSubnets: props.vpc.selectSubnets({subnetType: SubnetType.PUBLIC}),
            securityGroups: [props.ingestionSecuirtyGroup],
            platformVersion: FargatePlatformVersion.VERSION1_4,
            capacityProviderStrategies: [
                {
                    capacityProvider: 'FARGATE_SPOT',
                    weight: 1
                }
            ],
        });
        Tags.of(ecsService).add('Component', 'Skippr Ingest Jobs');

        // Optional secret for API key
        // ecsService.node.addDependency(props.skipprApiKeySecret)

        const skipprIngestContainerDef = new ecs.ContainerDefinition(
            scope,
            `${props.logicalName.toLowerCase()}-${props.pipelineName}-ingest-container-definition`,
            {
                image: ecs.ContainerImage.fromRegistry(`skippr/skipprd:${props.skipprVersion}`),
                taskDefinition: taskDef,
                stopTimeout: Duration.seconds(120),
                logging: new ecs.AwsLogDriver({
                    streamPrefix: skipprIngestStream.logStreamName,
                    mode: ecs.AwsLogDriverMode.NON_BLOCKING,
                }),
                environment: {
                    DATA_SOURCE_PLUGIN_NAME: props.sourcePluginName,
                    // DATA_SOURCE_S3_INVENTORY_BUCKET: props.sourceS3Bucket,
                    // DATA_SOURCE_S3_INVENTORY_PREFIX: props.sourceS3Prefix,

                    DATA_SOURCE_S3_BUCKET: props.sourceS3Bucket,
                    DATA_SOURCE_S3_PREFIX: props.sourceS3Prefix,

                    DATA_SOURCE_BATCH_SIZE_BYTES: props.sourceBatchSizeBytes,

                    BUFFER_THRESHOLD_BYTES: props.bufferThresholdBytes,
                    BUFFER_THRESHOLD_SECONDS: props.bufferThresholdSeconds,

                    TRANSFORM_NAMESPACE_FIELDS: props.transformNamespaceFieldNames,
                    TRANSFORM_BATCH_PARTITION_FIELDS: props.transformBatchPartitionFieldNames,
                    TRANSFORM_BATCH_TIME_FIELDS: props.transformBatchTimeFieldNames,
                    TRANSFORM_BATCH_TIME_UNIT: props.transformBatchTimeUnit,
                    TRANSFORM_FLATTEN_EVENTS: props.transformFlattenEvents,


                    DATA_OUTPUT_PLUGIN_NAME: props.outputPluginName,
                    DATA_OUTPUT_S3_BUCKET: props.datalakeBucket.bucketName,
                    DATA_OUTPUT_S3_PREFIX: props.outputS3Prefix,
                    DATA_OUTPUT_ATHENA_WORKGROUP_NAME: props.outputAthenaWorkgroupName,

                    SCHEMA_OUTPUT_PLUGIN_NAME: props.schemaOutputPluginName,
                    SCHEMA_OUTPUT_GLUE_DATABASE_NAME: props.schemaOutputGlueDatabaseName,

                    WORKSPACE_NAME: props.logicalName.toLowerCase(), // prefixes pipeline name to separate schemas across ENV's
                    PIPELINE_NAME: props.pipelineName,
                    DATA_DIR: './data',

                    SKIPPR_API_TOKEN: props.skipprApiKey, // remove this if using an AWS Secret

                    LOG_LEVEL: 'INFO'

                },
                // Optional secret for API key
                // secrets: {
                //     SKIPPR_API_TOKEN: ecs.Secret.fromSecretsManager(props.skipprApiKeySecret),
                // }
            }
        );
        Tags.of(skipprIngestContainerDef).add('Component', 'Skippr Ingest Jobs');

        skipprIngestContainerDef.addUlimits({
            name: ecs.UlimitName.NOFILE,
            softLimit: 50000,
            hardLimit: 100000,
        });

        // Optional secret for API key
        // skipprIngestContainerDef.node.addDependency(props.skipprApiKeySecret)

        // Add a mount point to the container definition
        skipprIngestContainerDef.addMountPoints({
            readOnly: false,
            containerPath: '/data',
            sourceVolume: `efs-${props.pipelineName}`,
        });

    }
}
