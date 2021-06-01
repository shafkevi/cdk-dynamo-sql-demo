const AWS = require('aws-sdk');
const dynamo = new AWS.DynamoDB.DocumentClient({});

module.exports.getUsers = async ({
    PARAMETERS,
}) => {
    result = await dynamo.query({
        IndexName: "idx1",
        TableName: PARAMETERS["DynamoDBTableV3TableName"],
        KeyConditionExpression: "#partitionKey = :partitionKey and begins_with(#sortKey, :sortKey)",
        ExpressionAttributeValues: {
            ":partitionKey": "user",
            ":sortKey": "user#"
        },
        ExpressionAttributeNames: {
            "#partitionKey": "pkIdx1",
            "#sortKey": "skIdx1",
            "#name": "name",
            "#state": "state",
            "#age": "age",
        },
        ProjectionExpression: "#name, #age, #state"
    }).promise();
    result = result.Items;
    return result;
}

module.exports.getUser = async ({
    PARAMETERS,
    userId: userId,
}) => {
    const params = {
        TableName: PARAMETERS["DynamoDBTableV3TableName"],
        Key: {
            pk: `user#${userId}`,
            sk: `info`
        },
        ExpressionAttributeNames: {
            "#name": "name",
            "#age": "age",
            "#state": "state",
        },
        ProjectionExpression: "#name, #age, #state"
    }
    let result = await dynamo.get(params).promise();
    result = result.Item;
    return result;
}

module.exports.getOrdersByUser = async ({
    PARAMETERS,
    userId: userId,
}) => {
    result = await dynamo.query({
        TableName: PARAMETERS["DynamoDBTableV3TableName"],
        KeyConditionExpression: "#partitionKey = :partitionKey and begins_with(#sortKey, :sortKey)",
        ExpressionAttributeValues: {
            ":partitionKey": `user#${userId}`,
            ":sortKey": `order`
        },
        ExpressionAttributeNames: {
            "#partitionKey": "pk",
            "#sortKey": "sk",
            "#item": "item",
            "#qty": "qty",
            "#unitPrice": "unitPrice",
        },
        ProjectionExpression: "#item, #qty, #unitPrice"
    }).promise();
    result = result.Items;
    return result;
}