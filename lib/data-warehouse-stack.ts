import {CfnOutput, Construct, Fn, RemovalPolicy, Stack, StackProps, Tags} from '@aws-cdk/core';
import {Bucket} from "@aws-cdk/aws-s3";
import {Secret} from '@aws-cdk/aws-secretsmanager';
import {SkipprStack} from "./components/skippr";
import {createSkipprInfra} from "./components/infra";

export interface DataWarehouseStackProps extends StackProps {
  readonly env: {
    readonly region: string;
    readonly account: string;
  };
  readonly logicalName: string;
}

export class DataWarehouseStack extends Stack {
  constructor(scope: Construct, id: string, props: DataWarehouseStackProps) {
    super(scope, id, props);

    /**
     * A bucket for ingested data, managed by Skippr
     */
    const dataLakeBucket = new Bucket(this, `${props.logicalName.toLowerCase()}-datalake-bucket`, {
      bucketName: `${props.logicalName.toLowerCase()}-datalake`,
      removalPolicy: RemovalPolicy.DESTROY
    })
    Tags.of(dataLakeBucket).add('Component', 'Datalake Storage');

    // Optional secret for API key
    // const skipprApiKey = new Secret(this, `${props.logicalName.toLowerCase()}-skippr-api-key`, {
    //   secretName: 'DataWarehouse-Skippr-API-Key',
    //   removalPolicy: RemovalPolicy.DESTROY
    // })

    const sharedInfra = createSkipprInfra(this, props);

    const ingestionJob = new SkipprStack(this, `${props.logicalName.toLowerCase()}-data-warehouse-ingestion`, {
      ...props,
      ...sharedInfra,
      skipprVersion: "v3.2.0",

      sourcePluginName: "s3",
      sourceS3Bucket: '',
      sourceS3Prefix: "",
      sourceBatchSizeBytes: "",

      transformNamespaceFieldNames: '',

      transformBatchTimeFieldNames: '',
      transformBatchTimeUnit: '',

      transformBatchPartitionFieldNames: "",

      transformFlattenEvents: 'no',

      bufferThresholdBytes: "",
      bufferThresholdSeconds: "",

      outputPluginName: "athena",
      outputS3Prefix: "",
      outputAthenaWorkgroupName: "",

      schemaOutputPluginName: "aws_glue",
      schemaOutputGlueDatabaseName: "",

      datalakeBucket: dataLakeBucket,
      pipelineName: '',

      skipprApiKey: ''
    })
    Tags.of(ingestionJob).add('Service', 'Skippr');

    new CfnOutput(this, `${props.logicalName.toLowerCase()}-data-lake-bucket-arn-output`, {
      exportName: 'DataWarehouse::DataLake:S3Bucket:Arn',
      value: dataLakeBucket.bucketArn
    });

    new CfnOutput(this, `${props.logicalName.toLowerCase()}-data-lake-bucket-name-output`, {
      exportName: 'DataWarehouse::DataLake:S3Bucket:Name',
      value: dataLakeBucket.bucketName
    });

  }

}
