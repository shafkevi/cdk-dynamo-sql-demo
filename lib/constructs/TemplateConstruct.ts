import * as fs from "fs";
import * as path from 'path';
import { CfnOutput, Construct, Duration, RemovalPolicy, CustomResource } from "@aws-cdk/core";
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from "@aws-cdk/custom-resources";
import { CloneRepository, Ec2Environment } from "@aws-cdk/aws-cloud9";
import { SubnetType, Vpc } from "@aws-cdk/aws-ec2";
import { AttributeType, BillingMode, Table } from "@aws-cdk/aws-dynamodb";
import { AuroraCapacityUnit, AuroraPostgresEngineVersion, DatabaseClusterEngine, ServerlessCluster, SubnetGroup } from "@aws-cdk/aws-rds";
import * as logs from '@aws-cdk/aws-logs';
import * as cr from '@aws-cdk/custom-resources';
import * as lambda from '@aws-cdk/aws-lambda';

export interface TemplateProps { 
  userArn?: string;
  vpcId?: string;
}

export default class Template extends Construct {
  constructor(scope: Construct, id: string, props: TemplateProps) {
    super(scope, id);
    const {  } = props;

    const vpc = props.vpcId 
      ? Vpc.fromLookup(this, "userVpc", { vpcId: props.vpcId })
      : Vpc.fromLookup(this, "defaultVpc", { isDefault: true })
    ;

    const cloudNineInstance = new Ec2Environment(this, "CloudNineEnvironment", {
      vpc
    });

    // If the user is not same principle as the creator of the CDK stack, this gives us
    // a way to add additional permission to the Cloud9 instance:
    if (props.userArn) {
    const addCloudNineMembership = new AwsCustomResource(this, `addCloudNineMembership`, {
      installLatestAwsSdk: false,
      onCreate: {
        service: "Cloud9",
        action: "createEnvironmentMembership",
        parameters: {
          environmentId: cloudNineInstance.environmentId,
          permissions: "read-write",
            userArn: props.userArn
        },
        physicalResourceId: PhysicalResourceId.of('id'),
        // ignoreErrorCodesMatching: ".*",
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({resources: AwsCustomResourcePolicy.ANY_RESOURCE})
    });
    addCloudNineMembership.node.addDependency(cloudNineInstance);

    }

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

    // Lambda function will seed our databases with sample data:
    const seedFunction = new lambda.Function(this, "SeedFunction", {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda/seed-function')),
      environment: {
        SqlDatabaseSecretArn: sqlDatabase.secret!.secretArn,
        SqlDatabaseArn: sqlDatabase.clusterArn,
        DynamoTableName: dynamoDbTable.tableName
      }
    });

    sqlDatabase.grantDataApiAccess(seedFunction);
    sqlDatabase.secret!.grantRead(seedFunction);
    dynamoDbTable.grantReadWriteData(seedFunction);

    const seedFunctionProvider = new cr.Provider(this, 'SeedFunctionProvider', {
      onEventHandler: seedFunction,
      logRetention: logs.RetentionDays.ONE_DAY   // default is INFINITE
    });

    const mySeedFunctionResource = new CustomResource(this, "SeedFunctionResource", { 
      serviceToken: seedFunctionProvider.serviceToken,
      properties: {
        SomeProperty: "12345"   // changing this value will cause resource to re-run, useful if/when we change code in Lambda
      }
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
