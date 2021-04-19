const express = require('express');
const AWS = require('aws-sdk');

const PORT = 8080;
const HOST = '0.0.0.0';
const app = express();

const rds = new AWS.RDSDataService({});
const dynamo = new AWS.DynamoDB.DocumentClient({});
const cloudFormation = new AWS.CloudFormation({});
const PARAMETERS = {};

const dynamoOrSql = (req, res, next) => {
    if (Object.keys(req.query).includes("dynamo")){
        req.dynamo=true;
    }
    else {
        req.dynamo=false;
    }
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
            Key: {
                partitionKey: "users",
                sortKey: "b",
            }
        }).promise();
    }
    else {
        result = await rds.executeStatement({
            secretArn: PARAMETERS.SqlDatabaseSecretArn,
            resourceArn: PARAMETERS.SqlDatabaseArn,
            database: "app",
            sql:"select * from users",
        }).promise();
    }
    console.log(JSON.stringify(result));
    res.send(result);
//   res.send('NODE How to bring a containerized web app online in 12 minutes (from start to finish)');
});

(async () => {
    const stackInfo = await cloudFormation.describeStacks({
        StackName: process.env.STACK_NAME || "DynamoSqlDemoStack"
    }).promise();
    const outputs = stackInfo.Stacks[0].Outputs;
    outputs.map(o=>{return PARAMETERS[o.ExportName] = o.OutputValue});
})();

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);
