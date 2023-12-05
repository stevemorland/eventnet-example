// Example of how to run tests
//yarn test:int --stack=eventnet-test-stack --profile=leighton-dev --region=eu-west-2  --runInBand
// @ts-nocheck
import { EventNetClient, stackName } from "@leighton-digital/eventnet";
import { saveToDynamo, getFromDynamo } from "./utils/dynamoDBClient";
import { v4 as uuidv4 } from "uuid";
import * as producerSchema from "../EventSchema/producer.json";
import * as consumerSchema from "../EventSchema/consumer.json";

const dbname = `${stackName}-ddbtable`;
const eventBusName = `${stackName}-bus`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("Basic Test for Producer > ", () => {
  test("Add data to DDB, capture outcome", async () => {
    const eventNet = await EventNetClient.create();
    await eventNet.waitForOpenSocket();
    const item = {
      pk: uuidv4(),
      sk: "someSKValue",
      someValue: "another value",
    };
    await saveToDynamo(dbname, item);
    const events = await eventNet.matchEnvelope("*", "*", 1, 100000);
    await eventNet.waitForClosedSocket();
    expect(events[0]).toMatchSchema(producerSchema);
    expect(events).toHaveLength(1);
    console.log(events);
    await eventNet.closeClient();
  });
});

describe("Basic Test for Consumer > ", () => {
  test("Add data to DDB, capture outcome", async () => {
    const id = uuidv4();
    const eventNet = await EventNetClient.create();
    await eventNet.waitForOpenSocket();
    const Item = {
      EventBusName: eventBusName,
      Source: "another.service",
      DetailType: "some.detail",
      Detail: {
        metadata: {
          correlationId: id,
          service: "someService",
          domain: "someDomain",
        },
        data: {
          someValue: "another value",
        },
      },
    };
    expect(Item).toMatchSchema(consumerSchema);
    await eventNet.sendEvent(Item);
    await eventNet.closeClient();
    await sleep(3000);
    const getFromDb = await getFromDynamo(dbname, id);
    console.log(getFromDb);
    expect(getFromDb.Item.pk).toEqual(id);
    expect(getFromDb.Item.someValue).toEqual("someVal");
  });
});
