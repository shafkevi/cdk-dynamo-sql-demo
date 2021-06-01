const AWS = require('aws-sdk');
const rds = new AWS.RDSDataService({});

const { cleanSql } = require("../helpers.js");

module.exports.getUsers = async ({
    PARAMETERS
}) => {
    result = await rds.executeStatement({
        secretArn: PARAMETERS.SqlDatabaseSecretArn,
        resourceArn: PARAMETERS.SqlDatabaseArn,
        database: "app",
        sql:"select name, age, state from users",
        includeResultMetadata: true,
    }).promise();
    result = cleanSql(result["records"], result["columnMetadata"]);
    return result;
}

module.exports.getUser = async ({
    PARAMETERS,
    userId: userId,
}) => {
    result = await rds.executeStatement({
        secretArn: PARAMETERS.SqlDatabaseSecretArn,
        resourceArn: PARAMETERS.SqlDatabaseArn,
        database: "app",
        sql:"select name, age, state from users where id = :id",
        parameters: [{name: "name", value: {"doubleValue": userId}}],
        includeResultMetadata: true,
    }).promise();
    result = cleanSql(result["records"], result["columnMetadata"]);
    return result;
}

module.exports.getOrdersByUser = async ({
    PARAMETERS,
    userId: userId,
}) => {
    result = await rds.executeStatement({
        secretArn: PARAMETERS.SqlDatabaseSecretArn,
        resourceArn: PARAMETERS.SqlDatabaseArn,
        database: "app",
        sql: 
            `select o.item, o.qty, o.unit_price as "unitPrice" from users u ` + 
            `inner join orders o ` +
                `on o.user_id = u.id ` + 
            `where u.id = :id `,
        parameters: [{name: "name", value: {"doubleValue": userId}}],
        includeResultMetadata: true,
    }).promise();
    result = cleanSql(result["records"], result["columnMetadata"]);
    return result;
}