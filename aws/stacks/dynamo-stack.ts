import { App, CfnOutput, RemovalPolicy, Stack } from 'aws-cdk-lib'
import { AttributeType, BillingMode, StreamViewType, Table, ProjectionType } from 'aws-cdk-lib/aws-dynamodb'

interface DynamoProps {
  name: string
}

const RPOLICY = RemovalPolicy.DESTROY

export class DynamoStack extends Stack {
  constructor(app: App, id: string, props: DynamoProps) {
    super(app, id)

    const cardTable = new Table(this, 'CardTable', {
      partitionKey: { name: 'cardId', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      tableName: `${props.name}-CardTable`,
    });
    
    cardTable.addGlobalSecondaryIndex({
      indexName: 'cardNameIndex',
      partitionKey: {
        name: 'cardName',
        type: AttributeType.STRING,
      },
      projectionType: ProjectionType.ALL,
    });

    new CfnOutput(this, `${props.name}-CardTable-Name`, {
      value: cardTable.tableName,
      exportName: `${props.name}-CardTable-Name`
    })

    new CfnOutput(this, `${props.name}-CardTable-Arn`, {
      value: cardTable.tableArn,
      exportName: `${props.name}-CardTable-Arn`
    })

    const userTable = new Table(this, `${props.name}-UserTable`, {
      tableName: `${props.name}-UserTable`,
      partitionKey: {
        name: `userId`,
        type: AttributeType.STRING
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      stream: StreamViewType.NEW_IMAGE,
      removalPolicy: RPOLICY
    })

    userTable.addGlobalSecondaryIndex({
      indexName: 'email',
      partitionKey: {
        name: 'email',
        type: AttributeType.STRING
      }
    })

    new CfnOutput(this, `${props.name}-UserTable-Name`, {
      value: userTable.tableName,
      exportName: `${props.name}-UserTable-Name`
    })

    new CfnOutput(this, `${props.name}-UserTable-Arn`, {
      value: userTable.tableArn,
      exportName: `${props.name}-UserTable-Arn`
    })
  }
}