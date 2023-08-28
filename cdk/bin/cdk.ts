#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { PTPipelineStack } from "../lib/PTPipelineStack";

// Bootstrap: `npx cdk bootstrap --cloudformation-execution-policies arn:aws:iam::544470575466:policy/PTCloudformation`
//
// To manually deploy a stack separately use `cdk ls` to find the name

// const usRegion = { account: "544470575466", region: "us-west-2" };
const ukRegion = { account: "544470575466", region: "eu-west-2" };

const app = new cdk.App();

new PTPipelineStack(app, "PTPipelineStack", { env: ukRegion });

app.synth();
