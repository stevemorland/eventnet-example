import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as eventbridge from "aws-cdk-lib/aws-events";
import * as pipes from "aws-cdk-lib/aws-pipes";
import { EventNet } from "@leighton-digital/eventnet/lib/construct/";
import * as lambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import {
  Effect,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import path = require("path");
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";

interface CustomStackProps extends cdk.StackProps {
  test: boolean;
}

export class EventnetExampleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: CustomStackProps) {
    super(scope, id, props);

    const bus = new eventbridge.EventBus(this, "EventBus", {
      eventBusName: `${this.stackName}-bus`,
    });

    const eventNet = new EventNet(this, "EventNet", {
      prefix: this.stackName,
      eventBusName: bus.eventBusName,
      includeLogs: true,
      includeOutput: true,
    });

    const table = new dynamodb.Table(this, "Table", {
      tableName: `${this.stackName}-ddbtable`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    const sourcePolicy = new PolicyDocument({
      statements: [
        new PolicyStatement({
          resources: [table.tableArn, table.tableStreamArn!],
          actions: [
            "dynamodb:DescribeStream",
            "dynamodb:GetRecords",
            "dynamodb:GetShardIterator",
            "dynamodb:ListStreams",
          ],
          effect: Effect.ALLOW,
        }),
      ],
    });

    const targetPolicy = new PolicyDocument({
      statements: [
        new PolicyStatement({
          resources: [bus.eventBusArn],
          actions: ["events:PutEvents"],
          effect: Effect.ALLOW,
        }),
      ],
    });

    const pipelineRole = new Role(this, "PipesRole", {
      assumedBy: new ServicePrincipal("pipes.amazonaws.com"),
      inlinePolicies: {
        sourcePolicy,
        targetPolicy,
      },
    });

    const pipe = new pipes.CfnPipe(this, "Pipe", {
      name: "SampleTableModifyPipe",
      roleArn: pipelineRole.roleArn,
      source: table.tableStreamArn!,
      target: bus.eventBusArn,
      sourceParameters: {
        dynamoDbStreamParameters: {
          startingPosition: "LATEST",
          batchSize: 1,
        },
        filterCriteria: {
          filters: [
            {
              pattern: `{
                        "eventName": [{
                            "prefix": "INSERT"
                        }]
                    }`,
            },
          ],
        },
      },
      targetParameters: {
        eventBridgeEventBusParameters: {
          detailType: "some-event-type",
          source: "some.event.source",
        },
        inputTemplate: `
          {
            "metadata": {
              "domain": "somedomain",
              "service": "someservice",
              "correlationId": <$.eventID>
            },
            "data": {
              "PK": <$.dynamodb.Keys.pk.S>,
              "SK": <$.dynamodb.Keys.sk.S>,
              "someValue": <$.dynamodb.NewImage.someValue.S>
            }
        }          
        `,
      },
    });

    const fn = new lambda.NodejsFunction(this, "Function", {
      handler: "main",
      entry: path.join(
        path.resolve(__dirname).split("/node_modules")[0],
        `../src/function.ts`
      ),
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    table.grantReadWriteData(fn);

    new LogGroup(this, `nodeJsFunctionLogGroupHandler`, {
      logGroupName: `/aws/lambda/${fn.functionName}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      retention: RetentionDays.ONE_WEEK,
    });

    const rule = new events.Rule(this, "rule", {
      eventPattern: {
        source: ["another.service"],
      },
      eventBus: bus,
    });

    rule.addTarget(
      new targets.LambdaFunction(fn, {
        maxEventAge: cdk.Duration.hours(2),
        retryAttempts: 2,
      })
    );
  }
}
