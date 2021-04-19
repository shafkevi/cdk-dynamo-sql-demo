const express = require('express');
const AWS = require('aws-sdk');

const PORT = 8080;
const HOST = '0.0.0.0';
const app = express();

const rds = new AWS.RDSDataService({});
const dynamo = new AWS.DynamoDB.DocumentClient({});
const cloudFormation = new AWS.CloudFormation({});
const PARAMETERS = {};


const cleanSql = (records, meta) => {
    const output = []
    for (let i=0; i<records.length; i++){
        record = records[i];
        const record_output = {}
        for (let j = 0; j<record.length; j++){
            const item = record[j];
            if ("stringValue" in item)
                _value = item["stringValue"]
            else if ("longValue" in item)
                _value = item["longValue"]
            else if ("isNull" in item)
                _value = None
            else if ("arrayValues" in item) // # TODO: more fun nested work here if needed.
                _value = item["arrayValues"]
            record_output[meta[j]["label"]] = _value
        }
        output.push(record_output)
    }
    return output
}

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

(async () => {
    const stackInfo = await cloudFormation.describeStacks({
        StackName: process.env.STACK_NAME || "DynamoSqlDemoStack"
    }).promise();
    const outputs = stackInfo.Stacks[0].Outputs;
    outputs.map(o=>{return PARAMETERS[o.ExportName] = o.OutputValue});


    app.listen(PORT, HOST);
    console.log(`Running on http://${HOST}:${PORT}`);
})();