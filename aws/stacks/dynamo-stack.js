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
        // Catalogue of filaments sold for the HueForge-style deck box.
        // Retained on stack delete, same as the card table.
        const filamentTable = new aws_dynamodb_1.Table(this, 'FilamentTable', {
            partitionKey: { name: 'filamentId', type: aws_dynamodb_1.AttributeType.STRING },
            billingMode: aws_dynamodb_1.BillingMode.PAY_PER_REQUEST,
            tableName: `${props.name}-FilamentTable`,
        });
        new aws_cdk_lib_1.CfnOutput(this, `${props.name}-FilamentTable-Name`, {
            value: filamentTable.tableName,
            exportName: `${props.name}-FilamentTable-Name`
        });
        new aws_cdk_lib_1.CfnOutput(this, `${props.name}-FilamentTable-Arn`, {
            value: filamentTable.tableArn,
            exportName: `${props.name}-FilamentTable-Arn`
        });
    }
}
exports.DynamoStack = DynamoStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZHluYW1vLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZHluYW1vLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDZDQUFrRTtBQUNsRSwyREFBNEc7QUFNNUcsTUFBTSxPQUFPLEdBQUcsMkJBQWEsQ0FBQyxPQUFPLENBQUE7QUFFckMsTUFBYSxXQUFZLFNBQVEsbUJBQUs7SUFDcEMsWUFBWSxHQUFRLEVBQUUsRUFBVSxFQUFFLEtBQWtCO1FBQ2xELEtBQUssQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUE7UUFFZCxNQUFNLFNBQVMsR0FBRyxJQUFJLG9CQUFLLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRTtZQUM3QyxZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSw0QkFBYSxDQUFDLE1BQU0sRUFBRTtZQUM1RCxXQUFXLEVBQUUsMEJBQVcsQ0FBQyxlQUFlO1lBQ3hDLFNBQVMsRUFBRSxHQUFHLEtBQUssQ0FBQyxJQUFJLFlBQVk7U0FDckMsQ0FBQyxDQUFDO1FBRUgsU0FBUyxDQUFDLHVCQUF1QixDQUFDO1lBQ2hDLFNBQVMsRUFBRSxlQUFlO1lBQzFCLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsVUFBVTtnQkFDaEIsSUFBSSxFQUFFLDRCQUFhLENBQUMsTUFBTTthQUMzQjtZQUNELGNBQWMsRUFBRSw2QkFBYyxDQUFDLEdBQUc7U0FDbkMsQ0FBQyxDQUFDO1FBRUgsSUFBSSx1QkFBUyxDQUFDLElBQUksRUFBRSxHQUFHLEtBQUssQ0FBQyxJQUFJLGlCQUFpQixFQUFFO1lBQ2xELEtBQUssRUFBRSxTQUFTLENBQUMsU0FBUztZQUMxQixVQUFVLEVBQUUsR0FBRyxLQUFLLENBQUMsSUFBSSxpQkFBaUI7U0FDM0MsQ0FBQyxDQUFBO1FBRUYsSUFBSSx1QkFBUyxDQUFDLElBQUksRUFBRSxHQUFHLEtBQUssQ0FBQyxJQUFJLGdCQUFnQixFQUFFO1lBQ2pELEtBQUssRUFBRSxTQUFTLENBQUMsUUFBUTtZQUN6QixVQUFVLEVBQUUsR0FBRyxLQUFLLENBQUMsSUFBSSxnQkFBZ0I7U0FDMUMsQ0FBQyxDQUFBO1FBRUYsTUFBTSxTQUFTLEdBQUcsSUFBSSxvQkFBSyxDQUFDLElBQUksRUFBRSxHQUFHLEtBQUssQ0FBQyxJQUFJLFlBQVksRUFBRTtZQUMzRCxTQUFTLEVBQUUsR0FBRyxLQUFLLENBQUMsSUFBSSxZQUFZO1lBQ3BDLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsUUFBUTtnQkFDZCxJQUFJLEVBQUUsNEJBQWEsQ0FBQyxNQUFNO2FBQzNCO1lBQ0QsV0FBVyxFQUFFLDBCQUFXLENBQUMsZUFBZTtZQUN4QyxNQUFNLEVBQUUsNkJBQWMsQ0FBQyxTQUFTO1lBQ2hDLGFBQWEsRUFBRSxPQUFPO1NBQ3ZCLENBQUMsQ0FBQTtRQUVGLFNBQVMsQ0FBQyx1QkFBdUIsQ0FBQztZQUNoQyxTQUFTLEVBQUUsT0FBTztZQUNsQixZQUFZLEVBQUU7Z0JBQ1osSUFBSSxFQUFFLE9BQU87Z0JBQ2IsSUFBSSxFQUFFLDRCQUFhLENBQUMsTUFBTTthQUMzQjtTQUNGLENBQUMsQ0FBQTtRQUVGLElBQUksdUJBQVMsQ0FBQyxJQUFJLEVBQUUsR0FBRyxLQUFLLENBQUMsSUFBSSxpQkFBaUIsRUFBRTtZQUNsRCxLQUFLLEVBQUUsU0FBUyxDQUFDLFNBQVM7WUFDMUIsVUFBVSxFQUFFLEdBQUcsS0FBSyxDQUFDLElBQUksaUJBQWlCO1NBQzNDLENBQUMsQ0FBQTtRQUVGLElBQUksdUJBQVMsQ0FBQyxJQUFJLEVBQUUsR0FBRyxLQUFLLENBQUMsSUFBSSxnQkFBZ0IsRUFBRTtZQUNqRCxLQUFLLEVBQUUsU0FBUyxDQUFDLFFBQVE7WUFDekIsVUFBVSxFQUFFLEdBQUcsS0FBSyxDQUFDLElBQUksZ0JBQWdCO1NBQzFDLENBQUMsQ0FBQTtRQUVGLCtEQUErRDtRQUMvRCxvREFBb0Q7UUFDcEQsTUFBTSxhQUFhLEdBQUcsSUFBSSxvQkFBSyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDckQsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBRSxJQUFJLEVBQUUsNEJBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDaEUsV0FBVyxFQUFFLDBCQUFXLENBQUMsZUFBZTtZQUN4QyxTQUFTLEVBQUUsR0FBRyxLQUFLLENBQUMsSUFBSSxnQkFBZ0I7U0FDekMsQ0FBQyxDQUFDO1FBRUgsSUFBSSx1QkFBUyxDQUFDLElBQUksRUFBRSxHQUFHLEtBQUssQ0FBQyxJQUFJLHFCQUFxQixFQUFFO1lBQ3RELEtBQUssRUFBRSxhQUFhLENBQUMsU0FBUztZQUM5QixVQUFVLEVBQUUsR0FBRyxLQUFLLENBQUMsSUFBSSxxQkFBcUI7U0FDL0MsQ0FBQyxDQUFBO1FBRUYsSUFBSSx1QkFBUyxDQUFDLElBQUksRUFBRSxHQUFHLEtBQUssQ0FBQyxJQUFJLG9CQUFvQixFQUFFO1lBQ3JELEtBQUssRUFBRSxhQUFhLENBQUMsUUFBUTtZQUM3QixVQUFVLEVBQUUsR0FBRyxLQUFLLENBQUMsSUFBSSxvQkFBb0I7U0FDOUMsQ0FBQyxDQUFBO0lBQ0osQ0FBQztDQUNGO0FBNUVELGtDQTRFQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFwcCwgQ2ZuT3V0cHV0LCBSZW1vdmFsUG9saWN5LCBTdGFjayB9IGZyb20gJ2F3cy1jZGstbGliJ1xuaW1wb3J0IHsgQXR0cmlidXRlVHlwZSwgQmlsbGluZ01vZGUsIFN0cmVhbVZpZXdUeXBlLCBUYWJsZSwgUHJvamVjdGlvblR5cGUgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInXG5cbmludGVyZmFjZSBEeW5hbW9Qcm9wcyB7XG4gIG5hbWU6IHN0cmluZ1xufVxuXG5jb25zdCBSUE9MSUNZID0gUmVtb3ZhbFBvbGljeS5ERVNUUk9ZXG5cbmV4cG9ydCBjbGFzcyBEeW5hbW9TdGFjayBleHRlbmRzIFN0YWNrIHtcbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIGlkOiBzdHJpbmcsIHByb3BzOiBEeW5hbW9Qcm9wcykge1xuICAgIHN1cGVyKGFwcCwgaWQpXG5cbiAgICBjb25zdCBjYXJkVGFibGUgPSBuZXcgVGFibGUodGhpcywgJ0NhcmRUYWJsZScsIHtcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnY2FyZElkJywgdHlwZTogQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBCaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICB0YWJsZU5hbWU6IGAke3Byb3BzLm5hbWV9LUNhcmRUYWJsZWAsXG4gICAgfSk7XG4gICAgXG4gICAgY2FyZFRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ2NhcmROYW1lSW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICdjYXJkTmFtZScsXG4gICAgICAgIHR5cGU6IEF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIHByb2plY3Rpb25UeXBlOiBQcm9qZWN0aW9uVHlwZS5BTEwsXG4gICAgfSk7XG5cbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsIGAke3Byb3BzLm5hbWV9LUNhcmRUYWJsZS1OYW1lYCwge1xuICAgICAgdmFsdWU6IGNhcmRUYWJsZS50YWJsZU5hbWUsXG4gICAgICBleHBvcnROYW1lOiBgJHtwcm9wcy5uYW1lfS1DYXJkVGFibGUtTmFtZWBcbiAgICB9KVxuXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBgJHtwcm9wcy5uYW1lfS1DYXJkVGFibGUtQXJuYCwge1xuICAgICAgdmFsdWU6IGNhcmRUYWJsZS50YWJsZUFybixcbiAgICAgIGV4cG9ydE5hbWU6IGAke3Byb3BzLm5hbWV9LUNhcmRUYWJsZS1Bcm5gXG4gICAgfSlcblxuICAgIGNvbnN0IHVzZXJUYWJsZSA9IG5ldyBUYWJsZSh0aGlzLCBgJHtwcm9wcy5uYW1lfS1Vc2VyVGFibGVgLCB7XG4gICAgICB0YWJsZU5hbWU6IGAke3Byb3BzLm5hbWV9LVVzZXJUYWJsZWAsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogYHVzZXJJZGAsXG4gICAgICAgIHR5cGU6IEF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgYmlsbGluZ01vZGU6IEJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHN0cmVhbTogU3RyZWFtVmlld1R5cGUuTkVXX0lNQUdFLFxuICAgICAgcmVtb3ZhbFBvbGljeTogUlBPTElDWVxuICAgIH0pXG5cbiAgICB1c2VyVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnZW1haWwnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICdlbWFpbCcsXG4gICAgICAgIHR5cGU6IEF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9XG4gICAgfSlcblxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgYCR7cHJvcHMubmFtZX0tVXNlclRhYmxlLU5hbWVgLCB7XG4gICAgICB2YWx1ZTogdXNlclRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3Byb3BzLm5hbWV9LVVzZXJUYWJsZS1OYW1lYFxuICAgIH0pXG5cbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsIGAke3Byb3BzLm5hbWV9LVVzZXJUYWJsZS1Bcm5gLCB7XG4gICAgICB2YWx1ZTogdXNlclRhYmxlLnRhYmxlQXJuLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvcHMubmFtZX0tVXNlclRhYmxlLUFybmBcbiAgICB9KVxuXG4gICAgLy8gQ2F0YWxvZ3VlIG9mIGZpbGFtZW50cyBzb2xkIGZvciB0aGUgSHVlRm9yZ2Utc3R5bGUgZGVjayBib3guXG4gICAgLy8gUmV0YWluZWQgb24gc3RhY2sgZGVsZXRlLCBzYW1lIGFzIHRoZSBjYXJkIHRhYmxlLlxuICAgIGNvbnN0IGZpbGFtZW50VGFibGUgPSBuZXcgVGFibGUodGhpcywgJ0ZpbGFtZW50VGFibGUnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2ZpbGFtZW50SWQnLCB0eXBlOiBBdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IEJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHRhYmxlTmFtZTogYCR7cHJvcHMubmFtZX0tRmlsYW1lbnRUYWJsZWAsXG4gICAgfSk7XG5cbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsIGAke3Byb3BzLm5hbWV9LUZpbGFtZW50VGFibGUtTmFtZWAsIHtcbiAgICAgIHZhbHVlOiBmaWxhbWVudFRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3Byb3BzLm5hbWV9LUZpbGFtZW50VGFibGUtTmFtZWBcbiAgICB9KVxuXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBgJHtwcm9wcy5uYW1lfS1GaWxhbWVudFRhYmxlLUFybmAsIHtcbiAgICAgIHZhbHVlOiBmaWxhbWVudFRhYmxlLnRhYmxlQXJuLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvcHMubmFtZX0tRmlsYW1lbnRUYWJsZS1Bcm5gXG4gICAgfSlcbiAgfVxufSJdfQ==