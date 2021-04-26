const AWS = require('aws-sdk');
const { formatSqlRecords } = require("./helpers.js");
const csv = require('csvtojson');
const rds = new AWS.RDSDataService({});
const dynamo = new AWS.DynamoDB.DocumentClient({});

const PARAMETERS = {
    SqlDatabaseSecretArn: process.env.SqlDatabaseSecretArn,
    SqlDatabaseArn: process.env.SqlDatabaseArn,
    DynamoTableNameV1: process.env.DynamoTableNameV1,
    DynamoTableNameV2: process.env.DynamoTableNameV2,
    DynamoTableNameV3: process.env.DynamoTableNameV3
};

exports.handler = async (event, context) => {
    
    console.log('Received event:\n' + JSON.stringify(event, null, 2));
    console.log('Received context:\n' + JSON.stringify(context, null, 2));

    var physicalResourceId; 

    if (event.RequestType === 'Create' || event.RequestType === 'Update') {
        await seedRds();
        await seedDynamo('data/dynamodb-v1.csv', PARAMETERS.DynamoTableNameV1);
        await seedDynamo('data/dynamodb-v2.csv', PARAMETERS.DynamoTableNameV2);
        await seedDynamo('data/dynamodb-v3.csv', PARAMETERS.DynamoTableNameV3);
        physicalResourceId = event.LogicalResourceId; // we aren't creating any new resources, so can just use logical ID as physical ID
        return { 'PhysicalResourceId': physicalResourceId };
    }
    else if (event.RequestType === 'Delete') {
        // Nothing to do
        console.log('Resource deleted, nothing to do.');
        return;
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
        const csvFilePath = `data/${sqlData.data[dataType]}`;
        const rawData = await csv({
            delimiter: ',',
            nullObject: true,
        }).fromFile(csvFilePath);
        const data = removeEmptyStringsFromJsonArray(rawData);
        const schema = sqlData.schema[dataType];
        const records = formatSqlRecords(data, schema);
        result = await rds.batchExecuteStatement({
            secretArn: PARAMETERS.SqlDatabaseSecretArn,
            resourceArn: PARAMETERS.SqlDatabaseArn,
            database: "app",
            sql: sqlData.tables[dataType].insert,
            parameterSets: records,
        }).promise();
    }

}
exports.seedRds = seedRds;


const seedDynamo = async(csvFilePath, tableName) => {

    const jsonArray = await csv({
        delimiter: ',',
        nullObject: true
    }).fromFile(csvFilePath);

    const newItems = removeEmptyStringsFromJsonArray(jsonArray);

    let first = 0;
    const totalItems = newItems.length;
    console.log(`Items to write ${totalItems} to ${tableName}`);
    while (true){
        if (first > totalItems){
            break;
        }
        const itemsToWrite = newItems.slice(first, first+25);
        console.log(`Writing items ${first} through ${first+25}`)
        const results = await dynamo.batchWrite({
            RequestItems: {
                [tableName]: itemsToWrite.map(n=>{ return {
                    PutRequest: {
                        Item: n
                    }
                }})
            }
        }).promise();
        first = first + 25;
    }

};
exports.seedDynamo = seedDynamo;

// If our CSV contains an empty cell value, we interpret that to mean that the attribute itself
// is not present on the item, rather than the attribute being present with a blank "" string value.
// So, we must remove such elements from our item array before writing to DynamoDB:
function removeEmptyStringsFromJsonArray(jsonArray) {
    var response = [];
    for (const arrayItem of jsonArray) {
        response.push(Object.fromEntries(Object.entries(arrayItem).filter(([_, v]) => v != "")))
    }
    return response;

}