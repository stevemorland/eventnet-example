import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
const TABLE_NAME = process.env.TABLE_NAME;

const marshallOptions = {
  convertEmptyValues: true,
  removeUndefinedValues: true,
  convertClassInstanceToMap: false,
};

const unmarshallOptions = {
  wrapNumbers: false,
};

const translateConfig = { marshallOptions, unmarshallOptions };
const client = new DynamoDBClient({});
export const docClient = DynamoDBDocumentClient.from(client, translateConfig);

export const main = async (event: any) => {
  console.log({ event });

  const payload = {
    TableName: TABLE_NAME,
    Item: {
      pk: event.detail.metadata.correlationId,
      sk: event["detail-type"],
      someValue: "someVal",
    },
  };

  const saveToDb = await client.send(new PutCommand(payload));

  console.log({ saveToDb });
};
