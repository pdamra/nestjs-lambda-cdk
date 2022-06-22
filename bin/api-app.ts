#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import 'source-map-support/register';
import { ApiPipelineStack } from '../lib/api-pipeline-stack';

const {
  CDK_ENV: environmentName = 'dev',
  CDK_DEFAULT_ACCOUNT,
  AWS_DEFAULT_ACCOUNT_ID,
  CDK_DEFAULT_REGION,
  AWS_DEFAULT_REGION,
  DOMAIN_NAME: domainName = 'flexiledger.com',
  CODESTAR_CONNECTION_ARN:
    codestarConnectionArn = 'arn:aws:codestar-connections:us-east-1:205375198116:connection/e54f0a47-fef3-4cf8-8734-bb679211c671',
  GITHUB_PATH: githubPath = 'djheru/nestjs-lambda-cdk',
} = process.env;

const githubBranchName = environmentName === 'prod' ? 'main' : environmentName;

const account = CDK_DEFAULT_ACCOUNT || AWS_DEFAULT_ACCOUNT_ID;
const region = CDK_DEFAULT_REGION || AWS_DEFAULT_REGION;

const app = new cdk.App();

new ApiPipelineStack(app, 'flexiledger', {
  description: 'Flexiledger Application',
  env: { account, region },
  codestarConnectionArn,
  domainName,
  environmentName,
  githubBranchName,
  githubPath,
});
