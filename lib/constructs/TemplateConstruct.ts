import fs from "fs";
import path from "path";
import { Repository } from "@aws-cdk/aws-codecommit";
import { CfnOutput, Construct, Duration, RemovalPolicy } from "@aws-cdk/core";
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from "@aws-cdk/custom-resources";
import { Ec2Environment } from "@aws-cdk/aws-cloud9";
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

    const repositoryName = "Sample1";
    const branchName = "main";
    const authorName = "AwsStartups";

    const codeCommitRepository = new Repository(this, "demoRepository", {
      repositoryName: `${id}Repository`,
    });

    // Maybe need to try doing a putFile for each one instead?
    // Since right now I'm getting a "A parent commit ID is required. Either use GetBranch to retrieve the latest commit ID for the branch" error
    const initializeCodeCommitRepoCustomResource = new AwsCustomResource(this, `InitializeCodeCommitRepo`, {
      installLatestAwsSdk: false,
      onCreate: {
        service: "CodeCommit",
        action: "createCommit",
        parameters: {
          repositoryName,
          branchName,
          authorName,
          commitMessage: "Initializing Repo",
          parentCommitId: "",
          putFiles: [
            {
              filePath: "api.js",
              fileContent: Buffer.from(fs.readFileSync(path.join(__dirname, "..", "..", "src", "app","api.js"))).toString()
            },
            {
              filePath: "package.json",
              fileContent: Buffer.from(fs.readFileSync(path.join(__dirname, "..", "..", "src", "app","package.json"))).toString()
            }
          ]
        },
        physicalResourceId: PhysicalResourceId.of('id'),
        // ignoreErrorCodesMatching: ".*",
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({resources: AwsCustomResourcePolicy.ANY_RESOURCE})
    });

    const cloudNineInstance = new Ec2Environment(this, "CloudNineEnvironment", {
      vpc,
      clonedRepositories: [{
        repositoryUrl: codeCommitRepository.repositoryCloneUrlHttp,
        pathComponent: "~"
      }]
    })
    cloudNineInstance.node.addDependency(initializeCodeCommitRepoCustomResource);


    // const dynamoDbTable = new Table(this, "DynamoDBTable", {
    //     tableName: `${id}Table`,
    //     billingMode: BillingMode.PAY_PER_REQUEST,
    //     removalPolicy: RemovalPolicy.DESTROY,
    //     partitionKey: {
    //       name: "partitionKey",
    //       type: AttributeType.STRING
    //     },
    //     sortKey: {
    //       name: "sortKey",
    //       type: AttributeType.STRING
    //     }
    //   });

    //   const subnetGroup = new SubnetGroup(this, "SubnetGroup", {
    //     vpc,
    //     description: "Subnet Group for ThreeTierWebApp",
    //     vpcSubnets: vpc.selectSubnets({
    //       onePerAz: true,
    //       subnetType: SubnetType.PUBLIC
    //     })
    //   });
  
      // const sqlDatabase = new ServerlessCluster(this, 'Database', {
      //   removalPolicy: RemovalPolicy.DESTROY,
      //   engine: DatabaseClusterEngine.auroraPostgres({
      //     version: AuroraPostgresEngineVersion.VER_10_7,
      //   }),
      //   defaultDatabaseName: "app",
      //   scaling: {
      //     autoPause: Duration.hours(1),
      //     minCapacity: AuroraCapacityUnit.ACU_2,
      //     maxCapacity: AuroraCapacityUnit.ACU_2
      //   },
      //   enableDataApi: true,
      //   vpc,
      //   subnetGroup,
      // });


    new CfnOutput(this, "CodeCommitRepositoryName", {
      exportName: `CodeCommitRepositoryName`,
      value: codeCommitRepository.repositoryName
    });

    new CfnOutput(this, "cloud9IdeUrl", {
      exportName: `cloud9IdeUrl`,
      value: cloudNineInstance.ideUrl
    });

    // new CfnOutput(this, "DynamoTableName", {
    //   exportName: `DynamoTableName`,
    //   value: dynamoDbTable.tableName
    // });
    
    // new CfnOutput(this, "SqlDatabaseArn", {
    //   exportName: `SqlDatabaseArn`,
    //   value: sqlDatabase.clusterArn
    // });
    // new CfnOutput(this, "SqlDatabaseSecretArn", {
    //   exportName: `SqlDatabaseSecretArn`,
    //   value: sqlDatabase.secret ? sqlDatabase.secret.secretArn : ""
    // });

  }
}
