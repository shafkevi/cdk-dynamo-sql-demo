const AWS = require('aws-sdk');

const rds = new AWS.RDSDataService({});
const dynamo = new AWS.DynamoDB.DocumentClient({});
const cloudFormation = new AWS.CloudFormation({});
const PARAMETERS = {};

const seedDynamo = async() => {

};


const seedRds = async() => {
    result = await rds.executeStatement({
        secretArn: PARAMETERS.SqlDatabaseSecretArn,
        resourceArn: PARAMETERS.SqlDatabaseArn,
        database: "app",
        sql:"create table users if not exists (id uuid, name text, phone text, primary(id));",
    }).promise();
};

(async () => {
    const stackInfo = await cloudFormation.describeStacks({
        StackName: process.env.STACK_NAME || "DynamoSqlDemoStack"
    }).promise();
    const outputs = stackInfo.Stacks[0].Outputs;
    outputs.map(o=>{return PARAMETERS[o.ExportName] = o.OutputValue});

    await seedRds();
    await seedDynamo();

})();