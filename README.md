# Skippr CDK for AWS ECS Fargate

This project bootstraps a serverless Skippr job on AWS ECS Fargate.

The CDK creates the follow resources in your AWS Account:

- ECS Fargate Cluster, Service and Task Definitions
- Log Group
- Elastic File System
- S3 Bucket for ingested data
- Associated IAM Roles

This project reqquires:



# Configuration

Edit [consts.ts](./lib/consts.ts) and update:

- AWS Account ID (Target AWS Account ID to deploy infrastructure to)
- AWS Region (AWS Region of the target account)
- Projects Logical Name (A logical name for the deployed infra. e.g. 'Prod', 'Skippr Test', 'Acme Datalake', etc)

# Deploy 

In your local command shell:

```bash
npx cdk list
```