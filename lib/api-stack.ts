import {
  CorsHttpMethod,
  DomainName,
  HttpApi,
  HttpMethod,
} from '@aws-cdk/aws-apigatewayv2-alpha';
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { Code, Function, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { ApiGatewayv2DomainProperties } from 'aws-cdk-lib/aws-route53-targets';
import { pascalCase } from 'change-case';
import { Construct } from 'constructs';
import { resolve } from 'path';

export interface ApiStackProps extends StackProps {
  domainName: string;
  stageName: string;
}

export class ApiStack extends Stack {
  constructor(scope: Construct, private id: string, private props: ApiStackProps) {
    super(scope, id, props);

    const { domainName, stageName } = props;

    const stageDomainName =
      stageName === 'prod' ? `api.${domainName}` : `api.${stageName}.${domainName}`;

    const hostedZoneId = `${this.id}-hostedZone`;
    const hostedZone = HostedZone.fromLookup(this, hostedZoneId, {
      domainName,
      privateZone: false,
    });

    const certificateId = `${this.id}-cert`;
    const certificate = new Certificate(this, certificateId, {
      domainName: stageDomainName,
      validation: CertificateValidation.fromDns(hostedZone),
    });

    const apigDomainName = new DomainName(this, `${this.id}-domain-name`, {
      domainName: stageDomainName,
      certificate,
    });

    const httpApi = new HttpApi(this, `${this.id}-http-api`, {
      description: 'Sample HTTP API with Lambda integration running Nestjs',
      corsPreflight: {
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
        allowMethods: [
          CorsHttpMethod.OPTIONS,
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PUT,
          CorsHttpMethod.PATCH,
          CorsHttpMethod.DELETE,
        ],
        allowCredentials: true,
        allowOrigins: ['http://localhost:3000', `https://www.${stageDomainName}`],
      },
      defaultDomainMapping: {
        domainName: apigDomainName,
      },
      disableExecuteApiEndpoint: true,
    });

    new ARecord(this, `$this.id}-a-record`, {
      zone: hostedZone,
      target: RecordTarget.fromAlias(
        new ApiGatewayv2DomainProperties(
          apigDomainName.regionalDomainName,
          apigDomainName.regionalHostedZoneId
        )
      ),
    });

    const lambdaLayer = new LayerVersion(this, `${this.id}-lambda-layer`, {
      code: Code.fromAsset(resolve(__dirname, '../api/dist/node_modules')),
      compatibleRuntimes: [Runtime.NODEJS_14_X, Runtime.NODEJS_16_X],
      description: 'Node modules for lambda functions',
    });

    const handler = new Function(this, `${this.id}-lambda-fcn`, {
      code: Code.fromAsset(resolve(__dirname, '../api/dist'), {
        exclude: ['../api/dist/node_modules'],
      }),
      handler: 'lambda.handler',
      runtime: Runtime.NODEJS_16_X,
      layers: [lambdaLayer],
      environment: {
        NODE_PATH: '$NODE_PATH:/opt',
        IS_FUNKY: 'TRUE',
      },
    });

    httpApi.addRoutes({
      path: '/',
      methods: [HttpMethod.ANY],
      integration: new HttpLambdaIntegration(`${this.id}-http-integration`, handler),
    });

    new CfnOutput(this, pascalCase(`${this.id}-api-url`), {
      value: httpApi.url!,
    });
  }
}
