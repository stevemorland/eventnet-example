import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as eventbridge from "aws-cdk-lib/aws-events";
import * as pipes from "aws-cdk-lib/aws-pipes";
import {
  Effect,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";

interface CustomStackProps extends cdk.StackProps {
  test: boolean;
}

export class EventnetExampleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: CustomStackProps) {
    super(scope, id, props);

    const bus = new eventbridge.EventBus(this, "EventBus", {
      eventBusName: `${this.stackName}-bus`,
    });

    const table = new dynamodb.Table(this, "Table", {
      tableName: `${this.stackName}-ddbtable`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
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
            "meta-data": {
              "correlationId": <$.eventID>
            },
            "data": {
              "PK": <$.dynamodb.Keys.PK.S>,
              "SK": <$.dynamodb.Keys.SK.S>,
              "someValue": <$.dynamodb.NewImage.someValue.S>
            }
        }          
        `,
      },
    });
  }
}
