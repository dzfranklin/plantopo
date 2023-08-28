import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { PTStack, PTStackProps } from "./PTStack";

interface PTPrimaryStageProps extends cdk.StageProps {
  ptStackProps: PTStackProps;
}

export class PTPrimaryStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props: PTPrimaryStageProps) {
    super(scope, id, props);
    new PTStack(this, "PTStack", props.ptStackProps);
  }
}
