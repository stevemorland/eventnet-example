import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient(config);
const docClient = DynamoDBDocumentClient.from(client);

export const main = async (tableName: string, item: any) => {
  const command = new PutCommand({
    TableName: tableName,
    Item: item,
  });

  const response = await docClient.send(command);
  console.log(response);
  return response;
};
