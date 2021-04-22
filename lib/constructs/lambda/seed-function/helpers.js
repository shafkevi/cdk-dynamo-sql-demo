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
};

const formatSqlRecords = (data, schema) => {
    const output = [];
    for (let i=0; i< data.length; i++){
        const record = [];
        const item = data[i];
        for (const key in schema){
            if (item[key]){
            record.push({"name": key, "value": { [schema[key]]: item[key] }});
            }
            else {
                record.push({"name": key, "value": { isNull: true }});
            }
        }
        output.push(record);
    }
    return output;
    
};

module.exports = {cleanSql, formatSqlRecords};