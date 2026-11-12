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
        // HueForge print defaults for the deck box. One row, settingsId = "default".
        // Retained on stack delete, same as the filament table.
        const printSettingsTable = new aws_dynamodb_1.Table(this, 'PrintSettingsTable', {
            partitionKey: { name: 'settingsId', type: aws_dynamodb_1.AttributeType.STRING },
            billingMode: aws_dynamodb_1.BillingMode.PAY_PER_REQUEST,
            tableName: `${props.name}-PrintSettingsTable`,
        });
        new aws_cdk_lib_1.CfnOutput(this, `${props.name}-PrintSettingsTable-Name`, {
            value: printSettingsTable.tableName,
            exportName: `${props.name}-PrintSettingsTable-Name`
        });
        new aws_cdk_lib_1.CfnOutput(this, `${props.name}-PrintSettingsTable-Arn`, {
            value: printSettingsTable.tableArn,
            exportName: `${props.name}-PrintSettingsTable-Arn`
        });
    }
}
exports.DynamoStack = DynamoStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZHluYW1vLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZHluYW1vLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDZDQUFrRTtBQUNsRSwyREFBNEc7QUFNNUcsTUFBTSxPQUFPLEdBQUcsMkJBQWEsQ0FBQyxPQUFPLENBQUE7QUFFckMsTUFBYSxXQUFZLFNBQVEsbUJBQUs7SUFDcEMsWUFBWSxHQUFRLEVBQUUsRUFBVSxFQUFFLEtBQWtCO1FBQ2xELEtBQUssQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUE7UUFFZCxNQUFNLFNBQVMsR0FBRyxJQUFJLG9CQUFLLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRTtZQUM3QyxZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSw0QkFBYSxDQUFDLE1BQU0sRUFBRTtZQUM1RCxXQUFXLEVBQUUsMEJBQVcsQ0FBQyxlQUFlO1lBQ3hDLFNBQVMsRUFBRSxHQUFHLEtBQUssQ0FBQyxJQUFJLFlBQVk7U0FDckMsQ0FBQyxDQUFDO1FBRUgsU0FBUyxDQUFDLHVCQUF1QixDQUFDO1lBQ2hDLFNBQVMsRUFBRSxlQUFlO1lBQzFCLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsVUFBVTtnQkFDaEIsSUFBSSxFQUFFLDRCQUFhLENBQUMsTUFBTTthQUMzQjtZQUNELGNBQWMsRUFBRSw2QkFBYyxDQUFDLEdBQUc7U0FDbkMsQ0FBQyxDQUFDO1FBRUgsSUFBSSx1QkFBUyxDQUFDLElBQUksRUFBRSxHQUFHLEtBQUssQ0FBQyxJQUFJLGlCQUFpQixFQUFFO1lBQ2xELEtBQUssRUFBRSxTQUFTLENBQUMsU0FBUztZQUMxQixVQUFVLEVBQUUsR0FBRyxLQUFLLENBQUMsSUFBSSxpQkFBaUI7U0FDM0MsQ0FBQyxDQUFBO1FBRUYsSUFBSSx1QkFBUyxDQUFDLElBQUksRUFBRSxHQUFHLEtBQUssQ0FBQyxJQUFJLGdCQUFnQixFQUFFO1lBQ2pELEtBQUssRUFB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QUcsS0FBSyxDQUFDLElBQUkseUJBQXlCLEVBQUU7WUFDMUQsS0FBSyxFQUFFLGtCQUFrQixDQUFDLFFBQVE7WUFDbEMsVUFBVSxFQUFFLEdBQUcsS0FBSyxDQUFDLElBQUkseUJBQXlCO1NBQ25ELENBQUMsQ0FBQTtJQUNKLENBQUM7Q0FDRjtBQTlGRCxrQ0E4RkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBcHAsIENmbk91dHB1dCwgUmVtb3ZhbFBvbGljeSwgU3RhY2sgfSBmcm9tICdhd3MtY2RrLWxpYidcbmltcG9ydCB7IEF0dHJpYnV0ZVR5cGUsIEJpbGxpbmdNb2RlLCBTdHJlYW1WaWV3VHlwZSwgVGFibGUsIFByb2plY3Rpb25UeXBlIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJ1xuXG5pbnRlcmZhY2UgRHluYW1vUHJvcHMge1xuICBuYW1lOiBzdHJpbmdcbn1cblxuY29uc3QgUlBPTElDWSA9IFJlbW92YWxQb2xpY3kuREVTVFJPWVxuXG5leHBvcnQgY2xhc3MgRHluYW1vU3RhY2sgZXh0ZW5kcyBTdGFjayB7XG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBpZDogc3RyaW5nLCBwcm9wczogRHluYW1vUHJvcHMpIHtcbiAgICBzdXBlcihhcHAsIGlkKVxuXG4gICAgY29uc3QgY2FyZFRhYmxlID0gbmV3IFRhYmxlKHRoaXMsICdDYXJkVGFibGUnLCB7XG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2NhcmRJZCcsIHR5cGU6IEF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgdGFibGVOYW1lOiBgJHtwcm9wcy5uYW1lfS1DYXJkVGFibGVgLFxuICAgIH0pO1xuICAgIFxuICAgIGNhcmRUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdjYXJkTmFtZUluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnY2FyZE5hbWUnLFxuICAgICAgICB0eXBlOiBBdHRyaWJ1dGVUeXBlLlNUUklORyxcbiAgICAgIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogUHJvamVjdGlvblR5cGUuQUxMLFxuICAgIH0pO1xuXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBgJHtwcm9wcy5uYW1lfS1DYXJkVGFibGUtTmFtZWAsIHtcbiAgICAgIHZhbHVlOiBjYXJkVGFibGUudGFibGVOYW1lLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvcHMubmFtZX0tQ2FyZFRhYmxlLU5hbWVgXG4gICAgfSlcblxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgYCR7cHJvcHMubmFtZX0tQ2FyZFRhYmxlLUFybmAsIHtcbiAgICAgIHZhbHVlOiBjYXJkVGFibGUudGFibGVBcm4sXG4gICAgICBleHBvcnROYW1lOiBgJHtwcm9wcy5uYW1lfS1DYXJkVGFibGUtQXJuYFxuICAgIH0pXG5cbiAgICBjb25zdCB1c2VyVGFibGUgPSBuZXcgVGFibGUodGhpcywgYCR7cHJvcHMubmFtZX0tVXNlclRhYmxlYCwge1xuICAgICAgdGFibGVOYW1lOiBgJHtwcm9wcy5uYW1lfS1Vc2VyVGFibGVgLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6IGB1c2VySWRgLFxuICAgICAgICB0eXBlOiBBdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBCaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICBzdHJlYW06IFN0cmVhbVZpZXdUeXBlLk5FV19JTUFHRSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IFJQT0xJQ1lcbiAgICB9KVxuXG4gICAgdXNlclRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ2VtYWlsJyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnZW1haWwnLFxuICAgICAgICB0eXBlOiBBdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfVxuICAgIH0pXG5cbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsIGAke3Byb3BzLm5hbWV9LVVzZXJUYWJsZS1OYW1lYCwge1xuICAgICAgdmFsdWU6IHVzZXJUYWJsZS50YWJsZU5hbWUsXG4gICAgICBleHBvcnROYW1lOiBgJHtwcm9wcy5uYW1lfS1Vc2VyVGFibGUtTmFtZWBcbiAgICB9KVxuXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBgJHtwcm9wcy5uYW1lfS1Vc2VyVGFibGUtQXJuYCwge1xuICAgICAgdmFsdWU6IHVzZXJUYWJsZS50YWJsZUFybixcbiAgICAgIGV4cG9ydE5hbWU6IGAke3Byb3BzLm5hbWV9LVVzZXJUYWJsZS1Bcm5gXG4gICAgfSlcblxuICAgIC8vIENhdGFsb2d1ZSBvZiBmaWxhbWVudHMgc29sZCBmb3IgdGhlIEh1ZUZvcmdlLXN0eWxlIGRlY2sgYm94LlxuICAgIC8vIFJldGFpbmVkIG9uIHN0YWNrIGRlbGV0ZSwgc2FtZSBhcyB0aGUgY2FyZCB0YWJsZS5cbiAgICBjb25zdCBmaWxhbWVudFRhYmxlID0gbmV3IFRhYmxlKHRoaXMsICdGaWxhbWVudFRhYmxlJywge1xuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdmaWxhbWVudElkJywgdHlwZTogQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBCaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICB0YWJsZU5hbWU6IGAke3Byb3BzLm5hbWV9LUZpbGFtZW50VGFibGVgLFxuICAgIH0pO1xuXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBgJHtwcm9wcy5uYW1lfS1GaWxhbWVudFRhYmxlLU5hbWVgLCB7XG4gICAgICB2YWx1ZTogZmlsYW1lbnRUYWJsZS50YWJsZU5hbWUsXG4gICAgICBleHBvcnROYW1lOiBgJHtwcm9wcy5uYW1lfS1GaWxhbWVudFRhYmxlLU5hbWVgXG4gICAgfSlcblxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgYCR7cHJvcHMubmFtZX0tRmlsYW1lbnRUYWJsZS1Bcm5gLCB7XG4gICAgICB2YWx1ZTogZmlsYW1lbnRUYWJsZS50YWJsZUFybixcbiAgICAgIGV4cG9ydE5hbWU6IGAke3Byb3BzLm5hbWV9LUZpbGFtZW50VGFibGUtQXJuYFxuICAgIH0pXG5cbiAgICAvLyBIdWVGb3JnZSBwcmludCBkZWZhdWx0cyBmb3IgdGhlIGRlY2sgYm94LiBPbmUgcm93LCBzZXR0aW5nc0lkID0gXCJkZWZhdWx0XCIuXG4gICAgLy8gUmV0YWluZWQgb24gc3RhY2sgZGVsZXRlLCBzYW1lIGFzIHRoZSBmaWxhbWVudCB0YWJsZS5cbiAgICBjb25zdCBwcmludFNldHRpbmdzVGFibGUgPSBuZXcgVGFibGUodGhpcywgJ1ByaW50U2V0dGluZ3NUYWJsZScsIHtcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnc2V0dGluZ3NJZCcsIHR5cGU6IEF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgdGFibGVOYW1lOiBgJHtwcm9wcy5uYW1lfS1QcmludFNldHRpbmdzVGFibGVgLFxuICAgIH0pO1xuXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBgJHtwcm9wcy5uYW1lfS1QcmludFNldHRpbmdzVGFibGUtTmFtZWAsIHtcbiAgICAgIHZhbHVlOiBwcmludFNldHRpbmdzVGFibGUudGFibGVOYW1lLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvcHMubmFtZX0tUHJpbnRTZXR0aW5nc1RhYmxlLU5hbWVgXG4gICAgfSlcblxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgYCR7cHJvcHMubmFtZX0tUHJpbnRTZXR0aW5nc1RhYmxlLUFybmAsIHtcbiAgICAgIHZhbHVlOiBwcmludFNldHRpbmdzVGFibGUudGFibGVBcm4sXG4gICAgICBleHBvcnROYW1lOiBgJHtwcm9wcy5uYW1lfS1QcmludFNldHRpbmdzVGFibGUtQXJuYFxuICAgIH0pXG4gIH1cbn0iXX0=