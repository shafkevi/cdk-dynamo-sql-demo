
import { CfnOutput, Construct, RemovalPolicy } from "@aws-cdk/core";
import { Attribute, AttributeType, BillingMode, Table } from "@aws-cdk/aws-dynamodb";
import { IGrantable } from '@aws-cdk/aws-iam';


export interface DynamoTableProps { 
  tableName: string;
  billingMode?: BillingMode;
  removalPolicy?: RemovalPolicy;
  partitionKey?: Attribute,
  sortKey?: Attribute,
  grantReadWrite?: IGrantable[],
  grantRead?: IGrantable[],
}

export default class DynamoTable extends Construct {
  public readonly table: Table;
  public readonly tableName: string;
  public readonly tableArn: string;
  constructor(scope: Construct, id: string, props: DynamoTableProps) {
    super(scope, id);

    props.billingMode = (props.billingMode ? props.billingMode : BillingMode.PAY_PER_REQUEST);
    props.removalPolicy = (props.removalPolicy ? props.removalPolicy : RemovalPolicy.DESTROY);
    props.partitionKey = (props.partitionKey ? props.partitionKey : {name: "pk", type: AttributeType.STRING});
    // props.sortKey = (÷props.sortKey ? props.sortKey : {name: "sk", type: AttributeType.STRING});

    this.table = new Table(this, id, {
        tableName: props.tableName,
        billingMode: props.billingMode,
        removalPolicy: props.removalPolicy,
        partitionKey: props.partitionKey,
        sortKey: props.sortKey,
    });
    this.tableName = this.table.tableName;
    this.tableArn = this.table.tableArn;

    if (props.grantReadWrite && props.grantReadWrite.length > 0){
        for (const grantable of props.grantReadWrite){
            this.table.grantReadWriteData(grantable);
        }
    }
    if (props.grantRead && props.grantRead.length > 0){
        for (const grantable of props.grantRead){
            this.table.grantReadData(grantable);
        }
    }
    new CfnOutput(this, `${id}TableName`, {
        exportName: `${id}TableName`,
        value: this.tableName
      });

  }
}
