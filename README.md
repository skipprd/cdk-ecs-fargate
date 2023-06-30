# Skippr CDK for AWS ECS Fargate

This project bootstraps a serverless [Skippr](https://github.com/skipprd/skipprd) job on AWS ECS Fargate via [AWS Typescript CDK](https://docs.aws.amazon.com/cdk/latest/guide/home.html) Infrastructure as Code (IaC).

The CDK creates the follow resources in your AWS Account:

- ECS Fargate Cluster, Service and Task Definitions
- Log Group
- Elastic File System
- S3 Bucket for ingested data
- Associated IAM Roles
 

# Install

It is assumed that you have the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) installed and configured with credentials for the target AWS account.

Install the project dependencies:

```bash
npm install
```

# Bootstrap CDK

CDK is a framework for defining cloud infrastructure in code. When you run `npx cdk deploy`, CDK will create a CloudFormation stack in the target AWS account that contains the resources required to deploy the project.

If this is the first time you are deploying a CDK project to the target AWS account, you will need to bootstrap the account:

```bash
npx cdk bootstrap
```

# Configure

## Skippr

This project assumes you have a Skippr account and an API key.

Please refer to [https://docs.skippr.io/](https://docs.skippr.io/) for more information on Skippr.

## AWS

This project assumes you have an AWS account and your IAM user has permissions to deploy the CDK project an associated AWS resources.


# Configuration

Edit [ ./lib/consts.ts](./lib/consts.ts) and update:

- AWS Account ID (Target AWS Account ID to deploy infrastructure to)
- AWS Region (AWS Region of the target account)
- Projects Logical Name (A logical name for the deployed infra. e.g. 'Prod', 'Skippr Test', 'Acme Datalake', etc)


Edit [./lib/data-warehouse-stack.ts](./lib/data-warehouse-stack.ts) and update the Skippr config for the `ingestionJob` resource:

```base
const ingestionJob = new SkipprStack(this, `${props.logicalName.toLowerCase()}-data-warehouse-ingestion`, {
      ...props,
      ...sharedInfra,
      
      // Edit config below
      
      skipprVersion: "v3.2.0",

      sourcePluginName: "s3_inventory",
      
      ... etc
```


# Optional Configuration

### Vertical Scaling

By default, the Skippr ECS Fargate task is configured to use 1 CPU and 2GB of memory.

If you need to increase the CPU or memory, you can edit the `./lib/data-warehouse-stack.ts` file and update the `taskDefinition` resource:

```base
const taskDefinition = new ecs.FargateTaskDefinition(this, `${props.logicalName.toLowerCase()}-task-definition`, {
      cpu: 1024, // 1 CPU
      memoryLimitMiB: 2048, // 2GB     
```

Please refer to [https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-cpu-memory-error.html](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-cpu-memory-error.html) for more information on CPU and memory limits for ECS Fargate.



### Horizontal Scaling

By default, the Skippr ECS Fargate service is configured to run 1 task.

Depending on the Skippr Input Plugin you are using, you may be able to increase the number of tasks to increase the ingestion throughput. 
For example the S3 Input Plugin scales vertically across cores by processing multiple files in parallel. 
Whereas the Kinesis Input Plugin also scales horizontally by processing multiple shards in parallel. 

Please refer to [Plugin Docs](https://docs.skippr.io/plugins/overview/) for more information and configuration options for Skippr plugins.

If you need to increase the number of tasks, you can edit the `./lib/data-warehouse-stack.ts` file and update the `service` resource:

```base
const service = new ecs.FargateService(this, `${props.logicalName.toLowerCase()}-service`, {
      cluster: cluster,
      taskDefinition: taskDefinition,
      desiredCount: 1, // 1 task
      ...
```


### Config Input / Output Plugins

This reference project is configure to use the `S3` input plugin and `Athena` output plugin.

If you intend to use different plugins, you will need to update the CDK in [./lib/components/skippr.ts](./li.b/components/skippr.ts)

Please refer to [https://docs.skippr.io/plugins/overview/](https://docs.skippr.io/plugins/overview/) for more information and configuration options for Skippr plugins.


# Deploy

In your local command shell:

```bash
npx cdk deploy DataWarehouse-Stack
```

# What Happens Now?

The CDK will create a CloudFormation stack in your AWS account that contains the resources required to deploy the project.

The CDK will also deploy the Skippr job to the ECS Fargate cluster.

The Skippr job will run and ingest data from the configured source (e.g. S3 bucket) and output the data to the configured destination (e.g. Athena).

You can monitor the Skippr job via the [AWS ECS Console](https://console.aws.amazon.com/ecs/home?region=us-east-1#/clusters). Look for the ECS Cluster name suffixed with `skippr-ecs-fargate-cluster` and the ECS Task named suffixed with `ingest-task`.

Click on the ECS Task and then click on the `Logs` tab to view the Skippr logs. You should see the Skippr job running and ingesting data.

Assuming you're ingesting to Athena, you can view the data in the [Athena Console](https://console.aws.amazon.com/athena/home?region=us-east-1#query) and select the database and table you configured in the Skippr job.

AWS Glue is used to create the Athena table. You can view the table in the [AWS Glue Console](https://console.aws.amazon.com/glue/home?region=us-east-1#catalog:tab=tables) and view the table properties and schema.

Finally, you can view the data in the S3 bucket you configured in the Skippr job via the [AWS S3 Console](https://s3.console.aws.amazon.com/s3/home?region=us-east-1#). Look for the S3 bucket name suffixed with `datalake-bucket`. 
