import * as path from 'path';
import { CfnOutput, Stack, StackProps, Construct, Duration, RemovalPolicy, CustomResource } from "@aws-cdk/core";
import { SubnetType, Vpc } from "@aws-cdk/aws-ec2";
import { AttributeType } from "@aws-cdk/aws-dynamodb";
import { AuroraCapacityUnit, AuroraPostgresEngineVersion, DatabaseClusterEngine, ServerlessCluster, SubnetGroup } from "@aws-cdk/aws-rds";
import { RetentionDays } from '@aws-cdk/aws-logs';
import { Provider } from '@aws-cdk/custom-resources';
import { Function, Runtime, Code } from '@aws-cdk/aws-lambda';
import DynamoTable from '../constructs/DynamoTable';
import CloudNineInstance from '../constructs/CloudNineInstance';

interface CustomStackProps extends StackProps{ 
  vpcId?: string,
  userArn?: string,
}

export default class App extends Stack {
  constructor(scope: Construct, id: string, props?: CustomStackProps) {
    super(scope, id, props);


    const vpc = props && props.vpcId 
      ? Vpc.fromLookup(this, "userVpc", { vpcId: props.vpcId })
      : Vpc.fromLookup(this, "defaultVpc", { isDefault: true })
    ;

    // Construct to create Cloud9, and allow current user to access it.
    const {cloudNineInstance} = new CloudNineInstance(this, "CloudNine", {
      vpc,
      userArn: props && props.userArn
    });

    // Our most basic table, which closely follows our relational mental model of one table = one entity type
    const {table: dynamoDbTableV1} = new DynamoTable(this, "DynamoDBTable-V1", {
      tableName: `${id}-V1`,
      partitionKey: {
        name: "user_id",
        type: AttributeType.STRING
      }
    });

    // With addition of a sort key, we introduce many:1 relation modeling in DynamoDB:
    const {table: dynamoDbTableV2} = new DynamoTable(this, "DynamoDBTable-V2", {
      tableName: `${id}-V2`,
      partitionKey: {
        name: "user_id",
        type: AttributeType.STRING
      },
      sortKey: {
        name: "sk",
        type: AttributeType.STRING,
      }
    });

    // we take this further, changing the partition key from "user_id" to "pk", which allows our
    // mental model to expand - we can now conceptually store completely different entity types,
    // even if they are unrelated, in the same table. This is important if/when ACID transactions
    // are needed, since DDB only supports transactions in a single table:
    const {table: dynamoDbTableV3} = new DynamoTable(this, "DynamoDBTable-V3", {
      tableName: `${id}-V3`,
      partitionKey: {
        name: "pk",
        type: AttributeType.STRING
      },
      sortKey: {
        name: "sk",
        type: AttributeType.STRING,
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
    const seedFunction = new Function(this, "SeedFunction", {
      runtime: Runtime.NODEJS_14_X,
      handler: 'index.handler',
      code: Code.fromAsset(path.join(__dirname, '../constructs/lambda/seed-function')),
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
    dynamoDbTableV2.grantReadWriteData(seedFunction);
    dynamoDbTableV3.grantReadWriteData(seedFunction);

    const seedFunctionProvider = new Provider(this, 'SeedFunctionProvider', {
      onEventHandler: seedFunction,
      logRetention: RetentionDays.ONE_DAY   // default is INFINITE
    });

    const mySeedFunctionResource = new CustomResource(this, "SeedFunctionResource", { 
      serviceToken: seedFunctionProvider.serviceToken,
      properties: {
        SomeProperty: "123"   // changing this value will cause resource to re-run, useful if/when we change code in Lambda
      }
    });
    
    new CfnOutput(this, `${id}SqlDatabaseArn`, {
      exportName: `SqlDatabaseArn`,
      value: sqlDatabase.clusterArn
    });
    new CfnOutput(this, `${id}SqlDatabaseSecretArn`, {
      exportName: `SqlDatabaseSecretArn`,
      value: sqlDatabase.secret!.secretArn
    });
  }
}
