import { Construct, Stack, StackProps } from "@aws-cdk/core";
import TemplateConstruct from "../constructs/TemplateConstruct";

export default class Template extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    new TemplateConstruct(this, id, { 
      vpcId: 'vpc-0a2cad50c98aed83f'    // optional param to use existing VPC; if not specified, will use default VPC.
      //userArn: 'xxxx'                 // optional, specify a user/role ARN that can access the Cloud9 instance; if not specified, only the IAM user/role running CDK can access the Cloud9
    });
  }
}
