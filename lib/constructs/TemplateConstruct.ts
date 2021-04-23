import * as path from 'path';
import { CfnOutput, Construct, Duration, RemovalPolicy, CustomResource } from "@aws-cdk/core";
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from "@aws-cdk/custom-resources";
import { Ec2Environment } from "@aws-cdk/aws-cloud9";
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

    // Our most basic table, which closely follows our relational mental model of one table = one entity type
    const dynamoDbTableV1 = new Table(this, "DynamoDBTable-V1", {
        tableName: `${id}-V1`,
        billingMode: BillingMode.PAY_PER_REQUEST,
        removalPolicy: RemovalPolicy.DESTROY,
        partitionKey: {
          name: "user_id",
          type: AttributeType.STRING
        }
    });

    // With addition of a sort key, we introduce many:1 relation modeling in DynamoDB:
    const dynamoDbTableV2 = new Table(this, "DynamoDBTable-V2", {
      tableName: `${id}-V2`,
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      partitionKey: {
        name: "user_id",
        type: AttributeType.STRING
      },
      sortKey: {
        name: "sk",
        type: AttributeType.STRING
      }
    });

    // we take this further, changing the partition key from "user_id" to "pk", which allows our
    // mental model to expand - we can now conceptually store completely different entity types,
    // even if they are unrelated, in the same table. This is important if/when ACID transactions
    // are needed, since DDB only supports transactions in a single table:
    const dynamoDbTableV3 = new Table(this, "DynamoDBTable-V3", {
      tableName: `${id}-V3`,
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      partitionKey: {
        name: "pk",
        type: AttributeType.STRING
      },
      sortKey: {
        name: "sk",
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
      timeout: Duration.seconds(10),
      environment: {
        SqlDatabaseSecretArn: sqlDatabase.secret!.secretArn,
        SqlDatabaseArn: sqlDatabase.clusterArn,
        DynamoTableNameV1: dynamoDbTableV1.tableName,
        DynamoTableNameV2: dynamoDbTableV2.tableName,
        DynamoTableNameV3: dynamoDbTableV3.tableName
      }
    });

    sqlDatabase.grantDataApiAccess(seedFunction);
    sqlDatabase.secret!.grantRead(seedFunction);
    dynamoDbTableV1.grantReadWriteData(seedFunction);

    const seedFunctionProvider = new cr.Provider(this, 'SeedFunctionProvider', {
      onEventHandler: seedFunction,
      logRetention: logs.RetentionDays.ONE_DAY   // default is INFINITE
    });

    const mySeedFunctionResource = new CustomResource(this, "SeedFunctionResource", { 
      serviceToken: seedFunctionProvider.serviceToken,
      properties: {
        SomeProperty: "123"   // changing this value will cause resource to re-run, useful if/when we change code in Lambda
      }
    });

    new CfnOutput(this, "cloud9IdeUrl", {
      exportName: `cloud9IdeUrl`,
      value: cloudNineInstance.ideUrl
    });

    new CfnOutput(this, "DynamoTableNameV1", {
      exportName: `DynamoTableNameV1`,
      value: dynamoDbTableV1.tableName
    });

    new CfnOutput(this, "DynamoTableNameV2", {
      exportName: `DynamoTableNameV2`,
      value: dynamoDbTableV2.tableName
    });

    new CfnOutput(this, "DynamoTableNameV3", {
      exportName: `DynamoTableNameV3`,
      value: dynamoDbTableV2.tableName
    });
    
    new CfnOutput(this, "SqlDatabaseArn", {
      exportName: `SqlDatabaseArn`,
      value: sqlDatabase.clusterArn
    });
    new CfnOutput(this, "SqlDatabaseSecretArn", {
      exportName: `SqlDatabaseSecretArn`,
      value: sqlDatabase.secret!.secretArn
    });

  }
}
