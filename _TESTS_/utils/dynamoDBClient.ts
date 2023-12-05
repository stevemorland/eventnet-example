import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  PutCommand,
  GetCommand,
  DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import { AWSConfig } from "@leighton-digital/eventnet";
const client = new DynamoDBClient(AWSConfig);
const docClient = DynamoDBDocumentClient.from(client);

export const saveToDynamo = async (tableName: string, item: any) => {
  const command = new PutCommand({
    TableName: tableName,
    Item: item,
  });

  const response = await docClient.send(command);
  console.log(response);
  return response;
};

export const getFromDynamo = async (tableName: string, pk: string) => {
  const command = new GetCommand({
    TableName: tableName,
    Key: {
      pk,
    },
  });

  const response = await docClient.send(command);
  console.log(response);
  return response;
};
