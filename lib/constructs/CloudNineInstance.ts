
import { CfnOutput, Construct } from "@aws-cdk/core";
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from "@aws-cdk/custom-resources";
import { Ec2Environment } from "@aws-cdk/aws-cloud9";
import { IVpc } from "@aws-cdk/aws-ec2";

export interface CloudNineInstanceProps { 
  vpc: IVpc,
  userArn?: string,
}

export default class CloudNineInstance extends Construct {
  public readonly cloudNineInstance: Ec2Environment;
  constructor(scope: Construct, id: string, props: CloudNineInstanceProps) {
    super(scope, id);

    this.cloudNineInstance = new Ec2Environment(this, `${id}Ec2Environment`, {
        vpc: props.vpc
      });

    if (props.userArn) {
      const addCloudNineMembership = new AwsCustomResource(this, `${id}Membership`, {
        installLatestAwsSdk: false,
        onCreate: {
        service: "Cloud9",
        action: "createEnvironmentMembership",
        parameters: {
            environmentId: this.cloudNineInstance.environmentId,
            permissions: "read-write",
            userArn: props.userArn
        },
        physicalResourceId: PhysicalResourceId.of("id"),
        // ignoreErrorCodesMatching: ".*",
        },
        policy: AwsCustomResourcePolicy.fromSdkCalls({resources: AwsCustomResourcePolicy.ANY_RESOURCE})
      });
      addCloudNineMembership.node.addDependency(this.cloudNineInstance);
    }

    new CfnOutput(this, `${id}IdeUrl`, {
      exportName: `${id}IdeUrl`,
      value: this.cloudNineInstance.ideUrl
    });

  }
}
