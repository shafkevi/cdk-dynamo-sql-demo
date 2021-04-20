const express = require('express');
const AWS = require('aws-sdk');
const { cleanSql } = require("./helpers.js");

const PORT = 8080;
const HOST = '0.0.0.0';
const app = express();

const rds = new AWS.RDSDataService({});
const dynamo = new AWS.DynamoDB.DocumentClient({});
const cloudFormation = new AWS.CloudFormation({});
const PARAMETERS = {};




const dynamoOrSql = (req, res, next) => {
    if (Object.keys(req.query).includes("dynamo")){ req.dynamo=true; }
    else { req.dynamo=false; }
    next();
};

app.use(dynamoOrSql);

// WIP
// App
app.get('/users', async(req, res, next) => {
    let result = {};
    if (req.dynamo){
        result = await dynamo.query({
            TableName: PARAMETERS.DynamoTableName,
            KeyConditionExpression: "partitionKey = :partitionKey",
            ExpressionAttributeValues: {
                ":partitionKey": "users",
            },
            ExpressionAttributeNames: {
                "#name": "name"
            },
            ProjectionExpression: "id, #name, phone"
        }).promise();
        result = result.Items;
    }
    else {
        result = await rds.executeStatement({
            secretArn: PARAMETERS.SqlDatabaseSecretArn,
            resourceArn: PARAMETERS.SqlDatabaseArn,
            database: "app",
            sql:"select * from users",
            includeResultMetadata: true,
        }).promise();
        result = cleanSql(result["records"], result["columnMetadata"])
    }

    console.log(JSON.stringify(result));
    res.send(result);
});


app.get('/users/:name', async(req, res, next) => {
    console.log(Object.keys(req));
    let result = {};
    if (req.dynamo){
        result = await dynamo.query({
            TableName: PARAMETERS.DynamoTableName,
            KeyConditionExpression: "partitionKey = :partitionKey and sortKey = :sortKey",
            ExpressionAttributeValues: {
                ":partitionKey": "users",
                ":sortKey": `user_${req.params.name}#`
            },
            ExpressionAttributeNames: {
                "#name": "name"
            },
            ProjectionExpression: "id, #name, phone"
        }).promise();
        result = result.Items;
    }
    else {
        result = await rds.executeStatement({
            secretArn: PARAMETERS.SqlDatabaseSecretArn,
            resourceArn: PARAMETERS.SqlDatabaseArn,
            database: "app",
            sql:"select * from users where name = :name",
            parameters: [{name: "name", value: {"stringValue": req.params.name}}],
            includeResultMetadata: true,
        }).promise();
        result = cleanSql(result["records"], result["columnMetadata"])
    }

    console.log(JSON.stringify(result));
    res.send(result);
});

app.get('/users/:name/address', async(req, res, next) => {
    console.log(Object.keys(req));
    let result = {};
    if (req.dynamo){
        result = await dynamo.query({
            TableName: PARAMETERS.DynamoTableName,
            KeyConditionExpression: "partitionKey = :partitionKey and sortKey = :sortKey",
            ExpressionAttributeValues: {
                ":partitionKey": "users",
                ":sortKey": `user_${req.params.name}#`
            },
            ExpressionAttributeNames: {
                "#name": "name"
            },
            ProjectionExpression: "id, #name, addresses"
        }).promise();
        result = result.Items;
    }
    else {
        result = await rds.executeStatement({
            secretArn: PARAMETERS.SqlDatabaseSecretArn,
            resourceArn: PARAMETERS.SqlDatabaseArn,
            database: "app",
            sql:"select u.name, a.* from users u inner join addresses a on a.user_id = u.id where u.name = :name",
            parameters: [{name: "name", value: {"stringValue": req.params.name}}],
            includeResultMetadata: true,
        }).promise();
        result = cleanSql(result["records"], result["columnMetadata"])
    }

    console.log(JSON.stringify(result));
    res.send(result);
});


(async () => {
    const stackInfo = await cloudFormation.describeStacks({
        StackName: process.env.STACK_NAME || "DynamoSqlDemoStack"
    }).promise();
    const outputs = stackInfo.Stacks[0].Outputs;
    outputs.map(o=>{return PARAMETERS[o.ExportName] = o.OutputValue});


    app.listen(PORT, HOST);
    console.log(`Running on http://${HOST}:${PORT}`);
})();