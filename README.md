# Skippr CDK for AWS ECS Fargate

This project bootstraps a serverless Skippr job on AWS ECS Fargate.

The CDK creates the follow resources in your AWS Account:

- ECS Fargate Cluster, Service and Task Definitions
- Log Group
- Elastic File System
- S3 Bucket for ingested data
- Associated IAM Roles

This project requires:



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

### Config Input / Output Plugins

This referene project is configure to use the `S3` input plugin and `Athena` output plugin.

IF you intend to use different plugins, you will need to update the CDK in [./lib/components/skippr.ts](./li.b/components/skippr.ts)

# Deploy 

In your local command shell:

```bash
npx cdk deploy DataWarehouse-Stack
```
