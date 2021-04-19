import fs from "fs";
import path from "path";
import { Repository } from "@aws-cdk/aws-codecommit";
import { CfnOutput, Construct, Duration, RemovalPolicy } from "@aws-cdk/core";
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from "@aws-cdk/custom-resources";
import { CloneRepository, Ec2Environment } from "@aws-cdk/aws-cloud9";
import { SubnetType, Vpc } from "@aws-cdk/aws-ec2";
import { AttributeType, BillingMode, Table } from "@aws-cdk/aws-dynamodb";
import { AuroraCapacityUnit, AuroraPostgresEngineVersion, DatabaseClusterEngine, ServerlessCluster, SubnetGroup } from "@aws-cdk/aws-rds";

export interface TemplateProps { }

export default class Template extends Construct {
  constructor(scope: Construct, id: string, props: TemplateProps) {
    super(scope, id);
    const {  } = props;

    const vpc = Vpc.fromLookup(this, "defaultVpc", {
      isDefault: true
    });

    const userArn = process.env.USER_ARN;

    const cloudNineInstance = new Ec2Environment(this, "CloudNineEnvironment", {
      vpc
    })

    const addCloudNineMembership = new AwsCustomResource(this, `addCloudNineMembership`, {
      installLatestAwsSdk: false,
      onCreate: {
        service: "Cloud9",
        action: "createEnvironmentMembership",
        parameters: {
          environmentId: cloudNineInstance.environmentId,
          permissions: "read-write",
          userArn
        },
        physicalResourceId: PhysicalResourceId.of('id'),
        // ignoreErrorCodesMatching: ".*",
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({resources: AwsCustomResourcePolicy.ANY_RESOURCE})
    });
    addCloudNineMembership.node.addDependency(cloudNineInstance);


    const dynamoDbTable = new Table(this, "DynamoDBTable", {
        tableName: `${id}Table`,
        billingMode: BillingMode.PAY_PER_REQUEST,
        removalPolicy: RemovalPolicy.DESTROY,
        partitionKey: {
          name: "partitionKey",
          type: AttributeType.STRING
        },
        sortKey: {
          name: "sortKey",
          type: AttributeType.STRING
        }
      });

      const subnetGroup = new SubnetGroup(this, "SubnetGroup", {
        vpc,
        description: "Subnet Group for ThreeTierWebApp",
        vpcSubnets: vpc.selectSubnets({
          onePerAz: true,
          subnetType: SubnetType.PUBLIC
        })
      });
  
      const sqlDatabase = new ServerlessCluster(this, 'Database', {
        removalPolicy: RemovalPolicy.DESTROY,
        engine: DatabaseClusterEngine.auroraPostgres({
          version: AuroraPostgresEngineVersion.VER_10_7,
        }),
        defaultDatabaseName: "app",
        scaling: {
          autoPause: Duration.hours(1),
          minCapacity: AuroraCapacityUnit.ACU_2,
          maxCapacity: AuroraCapacityUnit.ACU_2
        },
        enableDataApi: true,
        vpc,
        subnetGroup,
      });


    new CfnOutput(this, "cloud9IdeUrl", {
      exportName: `cloud9IdeUrl`,
      value: cloudNineInstance.ideUrl
    });

    new CfnOutput(this, "DynamoTableName", {
      exportName: `DynamoTableName`,
      value: dynamoDbTable.tableName
    });
    
    new CfnOutput(this, "SqlDatabaseArn", {
      exportName: `SqlDatabaseArn`,
      value: sqlDatabase.clusterArn
    });
    new CfnOutput(this, "SqlDatabaseSecretArn", {
      exportName: `SqlDatabaseSecretArn`,
      value: sqlDatabase.secret ? sqlDatabase.secret.secretArn : ""
    });

  }
}
