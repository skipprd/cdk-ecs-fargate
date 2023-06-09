import {Stack, StackProps} from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import {Peer, Port, SecurityGroup} from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';

export interface SkipprInfra {
    readonly vpc: ec2.IVpc;
    readonly ecsCluster: ecs.Cluster;
    readonly ingestionSecuirtyGroup: SecurityGroup;
    readonly efsSecurityGroup: SecurityGroup;
}

export interface SkipprProps extends StackProps {
    readonly env: {
        readonly region: string;
        readonly account: string;
    };
    readonly logicalName: string;
}

export function createSkipprInfra(scope: Stack, props: SkipprProps): SkipprInfra {

    const vpc = ec2.Vpc.fromLookup(scope, `default-vpc`, {
        isDefault: true,
    });

    const ingestionSecuirtyGroup = new SecurityGroup(scope, `${props.logicalName.toLowerCase()}-skippr-ingestion-sg`, {
        securityGroupName: `skippr-ingestion-sg`,
        description: `Skippr comms with Skippr.io to sync metadata`,
        vpc: vpc,
        allowAllOutbound: true // enable to sync data from external systems (e.g. public AWS service like S3)
    });
    ingestionSecuirtyGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(443), 'HTTPS from Skippr.io');

    const efsSecuirtyGroup = new SecurityGroup(scope, `${props.logicalName.toLowerCase()}-skippr-efs-ssg`, {
        securityGroupName: `skippr-efs-ssg`,
        description: `skippr comms with EFS`,
        vpc: vpc,
        allowAllOutbound: true // enable to sync data from external systems
    });
    efsSecuirtyGroup.addIngressRule(Peer.ipv4(vpc.vpcCidrBlock), Port.tcp(2049), 'EFS port from Skippr ECS containers');
    efsSecuirtyGroup.addEgressRule(Peer.ipv4(vpc.vpcCidrBlock), Port.allTcp(), 'Out to local network');

    const ecsCluster = new ecs.Cluster(scope, `${props.logicalName.toLowerCase()}-skippr-ecs-fargate-cluster`, {
        vpc: vpc,
        enableFargateCapacityProviders: true,
    });

    return {
        ecsCluster: ecsCluster,
        ingestionSecuirtyGroup: ingestionSecuirtyGroup,
        vpc: vpc,
        efsSecurityGroup: efsSecuirtyGroup
    }

}