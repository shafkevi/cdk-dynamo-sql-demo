const express = require('express');
const AWS = require('aws-sdk');
const dynamo = require('./databases/dynamo.js');
const sql = require('./databases/dynamo.js');

const PORT = 8080;
const HOST = '0.0.0.0';
const app = express();

let PARAMETERS = {};

const DBs = {
    "dynamo": dynamo,
    "sql": sql,
}

const whichDb = (req, res, next) => {
    if (Object.keys(req.query).includes("dynamo")){ 
        req.dbType="dynamo"; 
        req.db = DBs["dynamo"];
    }
    else { 
        req.dbType="sql"; 
        req.db = DBs["sql"]; 
    }
    next();
};

app.use(whichDb);

// WIP
// App
app.get('/users', async(req, res, next) => {
    let result = {};
    result = await req.db.getUsers({PARAMETERS});
    console.log(JSON.stringify(result));
    res.send(result);
});

app.get('/users/:id', async(req, res, next) => {
    let result = {};
    result = await req.db.getUser({PARAMETERS, userId: req.params.id});
    console.log(JSON.stringify(result));
    res.send(result);
});

app.get('/users/:id/orders', async(req, res, next) => {
    let result = {};
    result = await req.db.getOrdersByUser({PARAMETERS, userId: req.params.id});
    console.log(JSON.stringify(result));
    res.send(result);
});


(async () => {
    PARAMETERS = {
        "DynamoDBTableV1TableName": process.env.DynamoDBTableV1TableName || "DynamoSqlDemoStack-V1",
        "CloudNineIdeUrl": process.env.CloudNineIdeUrl,
        "DynamoDBTableV2TableName": process.env.DynamoDBTableV2TableName || "DynamoSqlDemoStack-V2",
        "SqlDatabaseArn": process.env.SqlDatabaseArn,
        "DynamoDBTableV3TableName": process.env.DynamoDBTableV3TableName || "DynamoSqlDemoStack-V3",
        "SqlDatabaseSecretArn": process.env.SqlDatabaseSecretArn,
    }
    console.log(JSON.stringify(PARAMETERS, null, 2));

    app.listen(PORT, HOST);
    console.log(`Running on http://${HOST}:${PORT}`);
})();