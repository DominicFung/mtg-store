"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamoStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const aws_dynamodb_1 = require("aws-cdk-lib/aws-dynamodb");
const RPOLICY = aws_cdk_lib_1.RemovalPolicy.DESTROY;
class DynamoStack extends aws_cdk_lib_1.Stack {
    constructor(app, id, props) {
        super(app, id);
        const cardTable = new aws_dynamodb_1.Table(this, 'CardTable', {
            partitionKey: { name: 'cardId', type: aws_dynamodb_1.AttributeType.STRING },
            billingMode: aws_dynamodb_1.BillingMode.PAY_PER_REQUEST,
            tableName: `${props.name}-CardTable`,
        });
        cardTable.addGlobalSecondaryIndex({
            indexName: 'cardNameIndex',
            partitionKey: {
                name: 'cardName',
                type: aws_dynamodb_1.AttributeType.STRING,
            },
            projectionType: aws_dynamodb_1.ProjectionType.ALL,
        });
        new aws_cdk_lib_1.CfnOutput(this, `${props.name}-CardTable-Name`, {
            value: cardTable.tableName,
            exportName: `${props.name}-CardTable-Name`
        });
        new aws_cdk_lib_1.CfnOutput(this, `${props.name}-CardTable-Arn`, {
            value: cardTable.tableArn,
            exportName: `${props.name}-CardTable-Arn`
        });
        const userTable = new aws_dynamodb_1.Table(this, `${props.name}-UserTable`, {
            tableName: `${props.name}-UserTable`,
            partitionKey: {
                name: `userId`,
                type: aws_dynamodb_1.AttributeType.STRING
            },
            billingMode: aws_dynamodb_1.BillingMode.PAY_PER_REQUEST,
            stream: aws_dynamodb_1.StreamViewType.NEW_IMAGE,
            removalPolicy: RPOLICY
        });
        userTable.addGlobalSecondaryIndex({
            indexName: 'email',
            partitionKey: {
                name: 'email',
                type: aws_dynamodb_1.AttributeType.STRING
            }
        });
        new aws_cdk_lib_1.CfnOutput(this, `${props.name}-UserTable-Name`, {
            value: userTable.tableName,
            exportName: `${props.name}-UserTable-Name`
        });
        new aws_cdk_lib_1.CfnOutput(this, `${props.name}-UserTable-Arn`, {
            value: userTable.tableArn,
            exportName: `${props.name}-UserTable-Arn`
        });
    }
}
exports.DynamoStack = DynamoStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZHluYW1vLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZHluYW1vLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDZDQUFrRTtBQUNsRSwyREFBNEc7QUFNNUcsTUFBTSxPQUFPLEdBQUcsMkJBQWEsQ0FBQyxPQUFPLENBQUE7QUFFckMsTUFBYSxXQUFZLFNBQVEsbUJBQUs7SUFDcEMsWUFBWSxHQUFRLEVBQUUsRUFBVSxFQUFFLEtBQWtCO1FBQ2xELEtBQUssQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUE7UUFFZCxNQUFNLFNBQVMsR0FBRyxJQUFJLG9CQUFLLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRTtZQUM3QyxZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSw0QkFBYSxDQUFDLE1BQU0sRUFBRTtZQUM1RCxXQUFXLEVBQUUsMEJBQVcsQ0FBQyxlQUFlO1lBQ3hDLFNBQVMsRUFBRSxHQUFHLEtBQUssQ0FBQyxJQUFJLFlBQVk7U0FDckMsQ0FBQyxDQUFDO1FBRUgsU0FBUyxDQUFDLHVCQUF1QixDQUFDO1lBQ2hDLFNBQVMsRUFBRSxlQUFlO1lBQzFCLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsVUFBVTtnQkFDaEIsSUFBSSxFQUFFLDRCQUFhLENBQUMsTUFBTTthQUMzQjtZQUNELGNBQWMsRUFBRSw2QkFBYyxDQUFDLEdBQUc7U0FDbkMsQ0FBQyxDQUFDO1FBRUgsSUFBSSx1QkFBUyxDQUFDLElBQUksRUFBRSxHQUFHLEtBQUssQ0FBQyxJQUFJLGlCQUFpQixFQUFFO1lBQ2xELEtBQUssRUFBRSxTQUFTLENBQUMsU0FBUztZQUMxQixVQUFVLEVBQUUsR0FBRyxLQUFLLENBQUMsSUFBSSxpQkFBaUI7U0FDM0MsQ0FBQyxDQUFBO1FBRUYsSUFBSSx1QkFBUyxDQUFDLElBQUksRUFBRSxHQUFHLEtBQUssQ0FBQyxJQUFJLGdCQUFnQixFQUFFO1lBQ2pELEtBQUssRUFBRSxTQUFTLENBQUMsUUFBUTtZQUN6QixVQUFVLEVBQUUsR0FBRyxLQUFLLENBQUMsSUFBSSxnQkFBZ0I7U0FDMUMsQ0FBQyxDQUFBO1FBRUYsTUFBTSxTQUFTLEdBQUcsSUFBSSxvQkFBSyxDQUFDLElBQUksRUFBRSxHQUFHLEtBQUssQ0FBQyxJQUFJLFlBQVksRUFBRTtZQUMzRCxTQUFTLEVBQUUsR0FBRyxLQUFLLENBQUMsSUFBSSxZQUFZO1lBQ3BDLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsUUFBUTtnQkFDZCxJQUFJLEVBQUUsNEJBQWEsQ0FBQyxNQUFNO2FBQzNCO1lBQ0QsV0FBVyxFQUFFLDBCQUFXLENBQUMsZUFBZTtZQUN4QyxNQUFNLEVBQUUsNkJBQWMsQ0FBQyxTQUFTO1lBQ2hDLGFBQWEsRUFBRSxPQUFPO1NBQ3ZCLENBQUMsQ0FBQTtRQUVGLFNBQVMsQ0FBQyx1QkFBdUIsQ0FBQztZQUNoQyxTQUFTLEVBQUUsT0FBTztZQUNsQixZQUFZLEVBQUU7Z0JBQ1osSUFBSSxFQUFFLE9BQU87Z0JBQ2IsSUFBSSxFQUFFLDRCQUFhLENBQUMsTUFBTTthQUMzQjtTQUNGLENBQUMsQ0FBQTtRQUVGLElBQUksdUJBQVMsQ0FBQyxJQUFJLEVBQUUsR0FBRyxLQUFLLENBQUMsSUFBSSxpQkFBaUIsRUFBRTtZQUNsRCxLQUFLLEVBQUUsU0FBUyxDQUFDLFNBQVM7WUFDMUIsVUFBVSxFQUFFLEdBQUcsS0FBSyxDQUFDLElBQUksaUJBQWlCO1NBQzNDLENBQUMsQ0FBQTtRQUVGLElBQUksdUJBQVMsQ0FBQyxJQUFJLEVBQUUsR0FBRyxLQUFLLENBQUMsSUFBSSxnQkFBZ0IsRUFBRTtZQUNqRCxLQUFLLEVBQUUsU0FBUyxDQUFDLFFBQVE7WUFDekIsVUFBVSxFQUFFLEdBQUcsS0FBSyxDQUFDLElBQUksZ0JBQWdCO1NBQzFDLENBQUMsQ0FBQTtJQUNKLENBQUM7Q0FDRjtBQTFERCxrQ0EwREMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBcHAsIENmbk91dHB1dCwgUmVtb3ZhbFBvbGljeSwgU3RhY2sgfSBmcm9tICdhd3MtY2RrLWxpYidcbmltcG9ydCB7IEF0dHJpYnV0ZVR5cGUsIEJpbGxpbmdNb2RlLCBTdHJlYW1WaWV3VHlwZSwgVGFibGUsIFByb2plY3Rpb25UeXBlIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJ1xuXG5pbnRlcmZhY2UgRHluYW1vUHJvcHMge1xuICBuYW1lOiBzdHJpbmdcbn1cblxuY29uc3QgUlBPTElDWSA9IFJlbW92YWxQb2xpY3kuREVTVFJPWVxuXG5leHBvcnQgY2xhc3MgRHluYW1vU3RhY2sgZXh0ZW5kcyBTdGFjayB7XG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBpZDogc3RyaW5nLCBwcm9wczogRHluYW1vUHJvcHMpIHtcbiAgICBzdXBlcihhcHAsIGlkKVxuXG4gICAgY29uc3QgY2FyZFRhYmxlID0gbmV3IFRhYmxlKHRoaXMsICdDYXJkVGFibGUnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2NhcmRJZCcsIHR5cGU6IEF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgdGFibGVOYW1lOiBgJHtwcm9wcy5uYW1lfS1DYXJkVGFibGVgLFxuICAgIH0pO1xuICAgIFxuICAgIGNhcmRUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdjYXJkTmFtZUluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnY2FyZE5hbWUnLFxuICAgICAgICB0eXBlOiBBdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogUHJvamVjdGlvblR5cGUuQUxMLFxuICAgIH0pO1xuXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBgJHtwcm9wcy5uYW1lfS1DYXJkVGFibGUtTmFtZWAsIHtcbiAgICAgIHZhbHVlOiBjYXJkVGFibGUudGFibGVOYW1lLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvcHMubmFtZX0tQ2FyZFRhYmxlLU5hbWVgXG4gICAgfSlcblxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgYCR7cHJvcHMubmFtZX0tQ2FyZFRhYmxlLUFybmAsIHtcbiAgICAgIHZhbHVlOiBjYXJkVGFibGUudGFibGVBcm4sXG4gICAgICBleHBvcnROYW1lOiBgJHtwcm9wcy5uYW1lfS1DYXJkVGFibGUtQXJuYFxuICAgIH0pXG5cbiAgICBjb25zdCB1c2VyVGFibGUgPSBuZXcgVGFibGUodGhpcywgYCR7cHJvcHMubmFtZX0tVXNlclRhYmxlYCwge1xuICAgICAgdGFibGVOYW1lOiBgJHtwcm9wcy5uYW1lfS1Vc2VyVGFibGVgLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6IGB1c2VySWRgLFxuICAgICAgICB0eXBlOiBBdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBCaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICBzdHJlYW06IFN0cmVhbVZpZXdUeXBlLk5FV19JTUFHRSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IFJQT0xJQ1lcbiAgICB9KVxuXG4gICAgdXNlclRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ2VtYWlsJyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnZW1haWwnLFxuICAgICAgICB0eXBlOiBBdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfVxuICAgIH0pXG5cbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsIGAke3Byb3BzLm5hbWV9LVVzZXJUYWJsZS1OYW1lYCwge1xuICAgICAgdmFsdWU6IHVzZXJUYWJsZS50YWJsZU5hbWUsXG4gICAgICBleHBvcnROYW1lOiBgJHtwcm9wcy5uYW1lfS1Vc2VyVGFibGUtTmFtZWBcbiAgICB9KVxuXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBgJHtwcm9wcy5uYW1lfS1Vc2VyVGFibGUtQXJuYCwge1xuICAgICAgdmFsdWU6IHVzZXJUYWJsZS50YWJsZUFybixcbiAgICAgIGV4cG9ydE5hbWU6IGAke3Byb3BzLm5hbWV9LVVzZXJUYWJsZS1Bcm5gXG4gICAgfSlcbiAgfVxufSJdfQ==