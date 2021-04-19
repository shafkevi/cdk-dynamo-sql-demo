const AWS = require('aws-sdk');

const rds = new AWS.RDSDataService({});
const dynamo = new AWS.DynamoDB.DocumentClient({});
const cloudFormation = new AWS.CloudFormation({});
const PARAMETERS = {};

const seedDynamo = async() => {

    newItems = require("./dynamoData.json");
    let first = 0;
    const totalItems = newItems.length;
    console.log(`Items to write ${totalItems}`);
    while (true){
        if (first > totalItems){
            break;
        }
        const itemsToWrite = newItems.slice(first, first+25);
        console.log(`Writing items ${first} through ${first+25}`)
        const results = await dynamo.batchWrite({
            RequestItems: {
                [PARAMETERS.DynamoTableName]: itemsToWrite.map(n=>{ return {
                    PutRequest: {
                        Item: n
                    }
                }})
            }
        }).promise();
        first = first + 25;
    }

};


const seedRds = async() => {
    console.log("Creating Tables");
    result = await rds.executeStatement({
        secretArn: PARAMETERS.SqlDatabaseSecretArn,
        resourceArn: PARAMETERS.SqlDatabaseArn,
        database: "app",
        sql:"create table if not exists users (id bigint, name text, phone text, primary key (id));",
    }).promise();
    console.log(result);
    console.log("Loading Data");

    result = await rds.batchExecuteStatement({
        secretArn: PARAMETERS.SqlDatabaseSecretArn,
        resourceArn: PARAMETERS.SqlDatabaseArn,
        database: "app",
        sql:"insert into users(id, name, phone) VALUES(:id,  :name, :phone) ON CONFLICT DO NOTHING",
        parameterSets: [
            [{ "name": "id", "value": {"doubleValue": "1"}}, { "name": "name", "value": {"stringValue": "Kevin"}}, { "name": "phone", "value": {"stringValue": "(123) 456-7890"}}],
            [{ "name": "id", "value": {"doubleValue": "2"}}, { "name": "name", "value": {"stringValue": "Mat"}}, { "name": "phone", "value": {"stringValue": "(456) 789-0123"}}],
        ]
    }).promise();
}

(async () => {
    const stackInfo = await cloudFormation.describeStacks({
        StackName: process.env.STACK_NAME || "DynamoSqlDemoStack"
    }).promise();
    const outputs = stackInfo.Stacks[0].Outputs;
    outputs.map(o=>{return PARAMETERS[o.ExportName] = o.OutputValue});

    await seedRds();
    await seedDynamo();

})();