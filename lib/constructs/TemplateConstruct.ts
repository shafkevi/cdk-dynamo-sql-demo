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
    console.log(userArn);
    const repositoryName = `${id}Repo`;
    const branchName = "main";
    const authorName = "AwsStartups";

    // const codeCommitRepository = new Repository(this, "demoRepository", {
    //   repositoryName: `${id}Repository`,
    // });
    const codeCommitRepository = new AwsCustomResource(this, `codeCommitRepository`, {
      installLatestAwsSdk: false,
      onCreate: {
        service: "CodeCommit",
        action: "createRepository",
        parameters: {
          repositoryName,
        },
        physicalResourceId: PhysicalResourceId.of('id'),
        // ignoreErrorCodesMatching: ".*",
      },
      onDelete: {
        service: "CodeCommit",
        action: "deleteRepository",
        parameters: {
          repositoryName,
        },
        physicalResourceId: PhysicalResourceId.of('id'),
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({resources: AwsCustomResourcePolicy.ANY_RESOURCE})
    });


    // Maybe need to try doing a putFile for each one instead?
    // Since right now I'm getting a "A parent commit ID is required. Either use GetBranch to retrieve the latest commit ID for the branch" error
    // https://docs.aws.amazon.com/codecommit/latest/userguide/how-to-create-commit.html#create-first-commit
    const codeCommitCodeCustomResource = new AwsCustomResource(this, `codeCommitCodeCustomResource`, {
      installLatestAwsSdk: false,
      onCreate: {
        service: "CodeCommit",
        action: "createCommit",
        parameters: {
          repositoryName,
          branchName,
          authorName,
          commitMessage: "Initializing Repo",
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
    codeCommitCodeCustomResource.node.addDependency(codeCommitRepository);

    // const codeCommitApiCustomResource = new AwsCustomResource(this, `codeCommitApiCustomResource`, {
    //   installLatestAwsSdk: false,
    //   onCreate: {
    //     service: "CodeCommit",
    //     action: "putFile",
    //     parameters: {
    //       repositoryName,
    //       branchName,
    //       commitMessage: "Initializing Repo with api.js",
    //       filePath: "api.js",
    //       fileContent: Buffer.from(fs.readFileSync(path.join(__dirname, "..", "..", "src", "app","api.js"))).toString()
    //     },
    //     physicalResourceId: PhysicalResourceId.of('id'),
    //     // ignoreErrorCodesMatching: ".*",
    //   },
    //   policy: AwsCustomResourcePolicy.fromSdkCalls({resources: AwsCustomResourcePolicy.ANY_RESOURCE})
    // });
    // codeCommitApiCustomResource.node.addDependency(codeCommitRepository);

    // const codeCommitPackageCustomResource = new AwsCustomResource(this, `codeCommitPackageCustomResource`, {
    //   installLatestAwsSdk: false,
    //   onCreate: {
    //     service: "CodeCommit",
    //     action: "putFile",
    //     parameters: {
    //       repositoryName,
    //       branchName,
    //       commitMessage: "Commiting Package.json",
    //       filePath: "package.json",
    //       fileContent: Buffer.from(fs.readFileSync(path.join(__dirname, "..", "..", "src", "app","package.json"))).toString()
    //     },
    //     physicalResourceId: PhysicalResourceId.of('id'),
    //     // ignoreErrorCodesMatching: ".*",
    //   },
    //   policy: AwsCustomResourcePolicy.fromSdkCalls({resources: AwsCustomResourcePolicy.ANY_RESOURCE})
    // });
    // codeCommitPackageCustomResource.node.addDependency(codeCommitRepository);

    const repository = Repository.fromRepositoryArn(this, "RepositoryConstruct", codeCommitRepository.getResponseField("repositoryMetadata.Arn"));
    const cloudNineInstance = new Ec2Environment(this, "CloudNineEnvironment", {
      vpc,
      clonedRepositories: [
        CloneRepository.fromCodeCommit(repository, "/src"),
      ]
    })
    cloudNineInstance.node.addDependency(codeCommitCodeCustomResource);

    // const callerIdentity = new AwsCustomResource(this, `callerIdentity`, {
    //   installLatestAwsSdk: false,
    //   onCreate: {
    //     service: "STS",
    //     action: "getCallerIdentity",
    //     physicalResourceId: PhysicalResourceId.of('id'),
    //     // ignoreErrorCodesMatching: ".*",
    //   },
    //   policy: AwsCustomResourcePolicy.fromSdkCalls({resources: AwsCustomResourcePolicy.ANY_RESOURCE})
    // });

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
    // addCloudNineMembership.node.addDependency(callerIdentity);
    addCloudNineMembership.node.addDependency(cloudNineInstance);


    // cloudNineInstance.node.addDependency(codeCommitPackageCustomResource);
    // cloudNineInstance.node.addDependency(codeCommitApiCustomResource);


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
      value: repositoryName
    });

    // new CfnOutput(this, "cloud9IdeUrl", {
    //   exportName: `cloud9IdeUrl`,
    //   value: cloudNineInstance.ideUrl
    // });

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
