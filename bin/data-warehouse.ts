#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { DataWarehouseStack } from "../lib/data-warehouse-stack";
import { AWS_ACCOUNT_ID, AWS_REGION, LOGICAL_NAME } from "../lib/consts";

const app = new cdk.App();

new DataWarehouseStack(app, 'DataWarehouse-CICD', {
  env: {
    account: AWS_ACCOUNT_ID,
    region: AWS_REGION,
  },
  logicalName: LOGICAL_NAME
});

app.synth();
