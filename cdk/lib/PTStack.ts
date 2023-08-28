import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3_deployment from "aws-cdk-lib/aws-s3-deployment";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import * as rds from "aws-cdk-lib/aws-rds";

const NODE_IMAGE = "node:18"; // lts on 29-08-2023
const RUST_IMAGE = "rust:slim-buster"; // latest on 29-08-2023

export interface PTStackProps extends cdk.StackProps {
  ptEnv: "test" | "prod";
  domainName: string;
  domainCert: cdk.aws_certificatemanager.ICertificate;
  securityGroup: cdk.aws_ec2.ISecurityGroup;
}

export class PTStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PTStackProps) {
    super(scope, id, props);

    // Apply to ourselves and all children
    cdk.Tags.of(this).add("ptEnv", props.ptEnv);

    // APP

    const appBucket = new s3.Bucket(this, "AppBucket", {
      websiteIndexDocument: "index.html",
      publicReadAccess: true,
    });

    const distribution = new cf.Distribution(this, "Distribution", {
      domainNames: [props.domainName],
      certificate: props.domainCert,
      defaultBehavior: {
        origin: new origins.S3Origin(appBucket),
      },
    });

    const nodeImage = cdk.DockerImage.fromRegistry(NODE_IMAGE);
    const rustImage = cdk.DockerImage.fromRegistry(RUST_IMAGE);

    const appSource = s3_deployment.Source.asset("../app", {
      bundling: {
        image: nodeImage,
        command: [
          "bash",
          "-c",
          [
            "cd /asset-input",
            "npm ci",
            "npm run build",
            "mv out/* /asset-output",
          ].join(" && "),
        ],
      },
    });

    const mapSourcesFile = s3_deployment.Source.asset("../map_sources", {
      bundling: {
        image: rustImage,
        command: [
          "sh",
          "-c",
          [
            "cd /asset-input",
            "cargo build --locked",
            "cargo run .",
            "mv out/mapSources.json /asset-output",
          ].join(" && "),
        ],
      },
    });

    new s3_deployment.BucketDeployment(this, "DeployApp", {
      sources: [mapSourcesFile, appSource],
      destinationBucket: appBucket,
      distribution,
    });

    // SERVER

    // To setup:
    // - allow my ip inbound in vpc security group
    // > export PGHOST=personal.cpnvuvmvcepv.eu-west-2.rds.amazonaws.com
    // > export PGUSER=postgres
    // > export PGPASSWORD=$(op read op://Personal/postgres/password)
    // create op://plantopo/plantopo_test and op://plantopo/plantopo_prod
    // > createuser plantopo_test --pwprompt # Enter password from op
    // > createuser plantopo_prod --pwprompt # Enter password from op
    // psql> GRANT plantopo_test TO postgres;
    // psql> GRANT plantopo_prod TO postgres;
    // psql> CREATE DATABASE plantopo_test OWNER plantopo_test;
    // psql> CREATE DATABASE plantopo_prod OWNER plantopo_prod;
    // > aws secretsmanager create-secret --name pt-test-pg-pw --secret-string $(op read op://plantopo/test_postgres/password) --region eu-west-2
    // > aws secretsmanager create-secret --name pt-prod-pg-pw --secret-string $(op read op://plantopo/prod_postgres/password) --region eu-west-2
    const pgInstance = rds.DatabaseInstance.fromDatabaseInstanceAttributes(
      this,
      "PGInstance",
      {
        instanceResourceId: "db-D3SXTKVTICU6MCN3LRPITWSYGU",
        instanceIdentifier: "personal",
        instanceEndpointAddress:
          "personal.cpnvuvmvcepv.eu-west-2.rds.amazonaws.com",
        port: 5432,
        securityGroups: [props.securityGroup],
      }
    );

    /** Secret pt/{test|prod} schema:
     *
     * pg_name - username and database name
     * pg_password
     * mapbox_access_token
     * os_api_key
     * maptiler_key
     * maxmind_license_key
     */
    const secret = Secret.fromSecretNameV2(this, "Secret", `pt/${props.ptEnv}`);

    // const vpc = new ec2.Vpc(this, "Vpc", {
    //   subnetConfiguration: [
    //     {
    //       subnetType: ec2.SubnetType.PUBLIC,
    //       name: "Ingress",
    //     },
    //   ],
    // });

    // const cluster = new ecs.Cluster(this, "Cluster", { vpc });
    // const asg = new AutoScalingGroup(this, "ASG", {
    //   vpc,
    //   instanceType: ec2.InstanceType.of(
    //     ec2.InstanceClass.T3,
    //     ec2.InstanceSize.NANO
    //   ),
    //   machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
    //   minCapacity: 1,
    //   maxCapacity: props.ptEnv === "prod" ? 2 : 1,
    // });
    // const capacityProvider = new ecs.AsgCapacityProvider(
    //   this,
    //   "AsgCapacityProvider",
    //   { autoScalingGroup: asg }
    // );
    // cluster.addAsgCapacityProvider(capacityProvider);

    // const service = new ApplicationLoadBalancedEc2Service(this, "Service", {
    //   cluster, // TODO: Do we need to specify?
    //   taskImageOptions: {},
    // });

    // const serverBuildEnvironment: BuildEnvironment = {
    //   buildImage: LinuxBuildImage.fromDockerRegistry(ELIXIR_IMAGE),
    // };
    // const serverTestEnvironment: BuildEnvironment = {
    //   ...serverBuildEnvironment,
    //   environmentVariables: {
    //     DB_USER: {
    //       type: BuildEnvironmentVariableType.SECRETS_MANAGER,
    //       value: testSecret.secretValueFromJson("pg_name"),
    //     },
    //     DB_NAME: {
    //       type: BuildEnvironmentVariableType.PLAINTEXT,
    //       value: testSecret.secretValueFromJson("pg_name"),
    //     },
    //     DB_HOSTNAME: {
    //       type: BuildEnvironmentVariableType.PLAINTEXT,
    //       value: pgInstance.dbInstanceEndpointAddress,
    //     },
    //     DB_PASSWORD: {
    //       type: BuildEnvironmentVariableType.SECRETS_MANAGER,
    //       value: testSecret.secretValueFromJson("pg_password"),
    //     },
    //   },
    // };
  }
}
