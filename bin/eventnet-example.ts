#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { EventnetExampleStack } from "../lib/eventnet-example-stack";

const app = new cdk.App();
new EventnetExampleStack(app, "EventnetExampleStack", {
  stackName: "eventnet-test-stack",
  test: true,
});
