import * as cdk from "aws-cdk-lib";
import {
  DetailType,
  NotificationRule,
} from "aws-cdk-lib/aws-codestarnotifications";
import {
  CodePipeline,
  CodePipelineSource,
  ManualApprovalStep,
  ShellStep,
} from "aws-cdk-lib/pipelines";
import { Construct } from "constructs";
import * as sns from "aws-cdk-lib/aws-sns";
import { EmailSubscription } from "aws-cdk-lib/aws-sns-subscriptions";
import { PTPrimaryStage } from "./PTPrimaryStage";
import * as acm from "aws-cdk-lib/aws-certificatemanager";

export class PTPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.tags.setTag("pt", "pt");

    const securityGroup = cdk.aws_ec2.SecurityGroup.fromSecurityGroupId(
      this,
      "SecurityGroup",
      "sg-03ce7442438fbe60c"
    );

    // Check you're in us-east-1 on the console. Manually create Route53 Hosted
    // Zone "plantopo.com" and ACM Certificate "plantopo.com" with alternate
    // name "*.plantopo.com" because it's hard to create the cert in us-east-1
    // (required to use with cloudfront) if we create it here
    const cert = acm.Certificate.fromCertificateArn(
      this,
      "Certificate",
      "arn:aws:acm:us-east-1:544470575466:certificate/2ddecbf9-d91f-47b3-9bce-ea5ebe90f8e5"
    );

    const repoSource = CodePipelineSource.gitHub(
      "danielzfranklin/plantopo",
      "main"
    );

    const pipe = new CodePipeline(this, "Pipeline", {
      pipelineName: "PTPipeline",
      synth: new ShellStep("Synth", {
        input: repoSource,
        commands: [
          "cd ${CODEBUILD_SRC_DIR}/cdk",
          "npm ci",
          "npm run build",
          "npm run cdk synth",
        ],
        primaryOutputDirectory: "${CODEBUILD_SRC_DIR}/cdk/cdk.out",
      }),
      dockerEnabledForSelfMutation: true,
      dockerEnabledForSynth: true,
      // Saves $1/month
      crossAccountKeys: false,
      // Uncomment to manually deploy
      selfMutation: true,
      useChangeSets: true,
    });

    const stageDomainName = "stage1.plantopo.com";
    pipe.addStage(
      new PTPrimaryStage(this, "DeployStaging", {
        ptStackProps: {
          ptEnv: "test",
          domainName: stageDomainName,
          domainCert: cert,
          securityGroup,
        },
      })
    );

    // pipe.addStage(
    //   new PTPrimaryStage(this, "DeployProd", {
    //     ptStackProps: {
    //       ptEnv: "prod",
    //       domainName: "plantopo.com",
    //       domainCert: cert,
    //       securityGroup,
    //     },
    //   }),
    //   {
    //     pre: [
    //       new ManualApprovalStep("CheckStaging", {
    //         comment: `Check ${stageDomainName}`,
    //       }),
    //     ],
    //   }
    // );

    pipe.buildPipeline();

    const notifyTopic = new sns.Topic(this, "Topic");
    notifyTopic.addSubscription(
      new EmailSubscription("daniel@danielzfranklin.org")
    );

    new NotificationRule(this, "Notification", {
      detailType: DetailType.BASIC,
      events: [
        "codepipeline-pipeline-pipeline-execution-started",
        "codepipeline-pipeline-pipeline-execution-failed",
        "codepipeline-pipeline-pipeline-execution-succeeded",
      ],
      source: pipe.pipeline,
      targets: [notifyTopic],
    });
  }
}
