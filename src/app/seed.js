const AWS = require('aws-sdk');
const { formatSqlRecords } = require("./helpers.js");

const rds = new AWS.RDSDataService({});
const dynamo = new AWS.DynamoDB.DocumentClient({});
const cloudFormation = new AWS.CloudFormation({});
const PARAMETERS = {};

const seedDynamo = async() => {

    newItems = require("./data/dynamoData.json");
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
    const sqlData = require("./data/sqlData.json");
    console.log("Creating Tables");
    for (const table in sqlData.tables){
        console.log(`  Creating: ${table} table`);
        result = await rds.executeStatement({
            secretArn: PARAMETERS.SqlDatabaseSecretArn,
            resourceArn: PARAMETERS.SqlDatabaseArn,
            database: "app",
            sql: sqlData.tables[table].create
        }).promise();
    }


    console.log("Loading Data");

    for (const dataType in sqlData.data){
        console.log(`  Loading: ${dataType}`);
        const data = sqlData.data[dataType];
        const schema = sqlData.schema[dataType];
        const records = formatSqlRecords(data, schema);
        console.log(JSON.stringify(records));
        result = await rds.batchExecuteStatement({
            secretArn: PARAMETERS.SqlDatabaseSecretArn,
            resourceArn: PARAMETERS.SqlDatabaseArn,
            database: "app",
            sql: sqlData.tables[dataType].insert,
            parameterSets: records,

        }).promise();
    }


}

(async () => {
    const stackInfo = await cloudFormation.describeStacks({
        StackName: process.env.STACK_NAME || "DynamoSqlDemoStack"
    }).promise();
    const outputs = stackInfo.Stacks[0].Outputs;
    outputs.map(o=>{return PARAMETERS[o.ExportName] = o.OutputValue});

    await seedRds();
    // await seedDynamo();

})();