const AWS = require('aws-sdk');
const { formatSqlRecords } = require("./helpers.js");
const cfnResponse = require('cfn-response.js');
const rds = new AWS.RDSDataService({});
const dynamo = new AWS.DynamoDB.DocumentClient({});

const PARAMETERS = {
    SqlDatabaseSecretArn: process.env.SqlDatabaseSecretArn,
    SqlDatabaseArn: process.env.SqlDatabaseArn,
    DynamoTableName: process.env.DynamoTableName
};

exports.handler = async (event, context) => {
    
    console.log('Received event:\n' + JSON.stringify(event, null, 2));
    console.log('Received context:\n' + JSON.stringify(context, null, 2));

    try {

        var responseData;
        var physicalResourceId; 

        if (event.RequestType === 'Create' || event.RequestType === 'Update') {
            await seedRds();
            await seedDynamo();
            physicalResourceId = event.LogicalResourceId; // we aren't creating any new resources, so can just use logical ID as physical ID
        }
        else if (event.RequestType === 'Delete') {
            // Nothing to do
        }

        return await cfnResponse.send(event, context, "SUCCESS", responseData, physicalResourceId); 
    }
    catch (err) {
        let errMsg = `${err.name}:\n${err.message}`;
        let responseData = { Error: errMsg };
        console.log(errMsg);
        return await cfnResponse.send(event, context, "FAILED", responseData); 
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