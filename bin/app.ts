import "source-map-support/register";
import { App } from "@aws-cdk/core";
import Stack from "../lib/stacks/Stack";

async function main() {
  const app = new App();
  const props = {
    vpcId: process.env.VPC_ID,
    userArn: process.env.USER_ARN,
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.AWS_REGION ??
        process.env.CDK_DEPLOY_REGION ??
        process.env.CDK_DEFAULT_REGION ??
        "us-east-1"
    }
  };
  const stackName = process.env.STACK_NAME || "DynamoSqlDemoStack";
  new Stack(app, stackName, props);
}

main().catch(console.error);
