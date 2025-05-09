"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IamStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const aws_iam_1 = require("aws-cdk-lib/aws-iam");
class IamStack extends aws_cdk_lib_1.Stack {
    constructor(app, id, props) {
        super(app, id);
        // const userDynamoArn = Fn.importValue(`${props.name}-UserTable-Arn`)
        // const songDynamoArn = Fn.importValue(`${props.name}-SongTable-Arn`)
        // const bandDynamoArn = Fn.importValue(`${props.name}-BandTable-Arn`)
        // const setListDynamoArn = Fn.importValue(`${props.name}-SetListTable-Arn`)
        // const jamDynamoArn = Fn.importValue(`${props.name}-JamTable-Arn`)
        // const inviteDynamoArn = Fn.importValue(`${props.name}-InviteTable-Arn`)
        const bucketArn = aws_cdk_lib_1.Fn.importValue(`${props.name}-bucketArn`);
        const user = new aws_iam_1.User(this, `${props.name}-User`);
        user.attachInlinePolicy(new aws_iam_1.Policy(this, `${props.name}-InlinePolicy`, {
            statements: [
                // new PolicyStatement({
                //   actions: [ "dynamodb:*" ],
                //   resources: [ 
                //     `${userDynamoArn}*`, `${bandDynamoArn}*`, `${songDynamoArn}*`, 
                //     `${setListDynamoArn}*`, `${jamDynamoArn}*`, `${inviteDynamoArn}*`
                //   ]
                // }),
                new aws_iam_1.PolicyStatement({
                    resources: [bucketArn, `${bucketArn}/*`],
                    actions: ["s3:*"]
                }),
            ]
        }));
        const accessKey = new aws_iam_1.AccessKey(this, `${props.name}-AccessKey`, { user });
        new aws_cdk_lib_1.CfnOutput(this, `${props.name}-AccessKey-Id`, {
            value: accessKey.accessKeyId,
            exportName: `${props.name}-AccessKey-Id`
        });
        new aws_cdk_lib_1.CfnOutput(this, `${props.name}-SecretKey`, {
            value: accessKey.secretAccessKey.unsafeUnwrap(),
            exportName: `${props.name}-SecretKey`
        });
    }
}
exports.IamStack = IamStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWFtLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiaWFtLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDZDQUF1RDtBQUN2RCxpREFBOEU7QUFNOUUsTUFBYSxRQUFTLFNBQVEsbUJBQUs7SUFDakMsWUFBWSxHQUFRLEVBQUUsRUFBVSxFQUFFLEtBQWU7UUFDL0MsS0FBSyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQTtRQUVkLHNFQUFzRTtRQUN0RSxzRUFBc0U7UUFDdEUsc0VBQXNFO1FBQ3RFLDRFQUE0RTtRQUM1RSxvRUFBb0U7UUFDcEUsMEVBQTBFO1FBRTFFLE1BQU0sU0FBUyxHQUFHLGdCQUFFLENBQUMsV0FBVyxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksWUFBWSxDQUFDLENBQUE7UUFFM0QsTUFBTSxJQUFJLEdBQUcsSUFBSSxjQUFJLENBQUMsSUFBSSxFQUFFLEdBQUcsS0FBSyxDQUFDLElBQUksT0FBTyxDQUFDLENBQUE7UUFDakQsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksZ0JBQU0sQ0FBQyxJQUFJLEVBQUUsR0FBRyxLQUFLLENBQUMsSUFBSSxlQUFlLEVBQUU7WUFDckUsVUFBVSxFQUFFO2dCQUNWLHdCQUF3QjtnQkFDeEIsK0JBQStCO2dCQUMvQixrQkFBa0I7Z0JBQ2xCLHNFQUFzRTtnQkFDdEUsd0VBQXdFO2dCQUN4RSxNQUFNO2dCQUNOLE1BQU07Z0JBQ04sSUFBSSx5QkFBZSxDQUFDO29CQUNsQixTQUFTLEVBQUUsQ0FBRSxTQUFTLEVBQUUsR0FBRyxTQUFTLElBQUksQ0FBRTtvQkFDMUMsT0FBTyxFQUFFLENBQUMsTUFBTSxDQUFDO2lCQUNsQixDQUFDO2FBQ0g7U0FDRixDQUFDLENBQUMsQ0FBQTtRQUVILE1BQU0sU0FBUyxHQUFHLElBQUksbUJBQVMsQ0FBQyxJQUFJLEVBQUUsR0FBRyxLQUFLLENBQUMsSUFBSSxZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFBO1FBRTFFLElBQUksdUJBQVMsQ0FBQyxJQUFJLEVBQUUsR0FBRyxLQUFLLENBQUMsSUFBSSxlQUFlLEVBQUU7WUFDaEQsS0FBSyxFQUFFLFNBQVMsQ0FBQyxXQUFXO1lBQzVCLFVBQVUsRUFBRSxHQUFHLEtBQUssQ0FBQyxJQUFJLGVBQWU7U0FDekMsQ0FBQyxDQUFBO1FBRUYsSUFBSSx1QkFBUyxDQUFDLElBQUksRUFBRSxHQUFHLEtBQUssQ0FBQyxJQUFJLFlBQVksRUFBRTtZQUM3QyxLQUFLLEVBQUUsU0FBUyxDQUFDLGVBQWUsQ0FBQyxZQUFZLEVBQUU7WUFDL0MsVUFBVSxFQUFFLEdBQUcsS0FBSyxDQUFDLElBQUksWUFBWTtTQUN0QyxDQUFDLENBQUE7SUFDSixDQUFDO0NBQ0Y7QUExQ0QsNEJBMENDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQXBwLCBDZm5PdXRwdXQsIFN0YWNrLCBGbiB9IGZyb20gJ2F3cy1jZGstbGliJ1xuaW1wb3J0IHsgQWNjZXNzS2V5LCBQb2xpY3ksIFBvbGljeVN0YXRlbWVudCwgVXNlciB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nXG5cbmludGVyZmFjZSBJYW1Qcm9wcyB7XG4gIG5hbWU6IHN0cmluZ1xufVxuXG5leHBvcnQgY2xhc3MgSWFtU3RhY2sgZXh0ZW5kcyBTdGFjayB7XG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBpZDogc3RyaW5nLCBwcm9wczogSWFtUHJvcHMpIHtcbiAgICBzdXBlcihhcHAsIGlkKVxuXG4gICAgLy8gY29uc3QgdXNlckR5bmFtb0FybiA9IEZuLmltcG9ydFZhbHVlKGAke3Byb3BzLm5hbWV9LVVzZXJUYWJsZS1Bcm5gKVxuICAgIC8vIGNvbnN0IHNvbmdEeW5hbW9Bcm4gPSBGbi5pbXBvcnRWYWx1ZShgJHtwcm9wcy5uYW1lfS1Tb25nVGFibGUtQXJuYClcbiAgICAvLyBjb25zdCBiYW5kRHluYW1vQXJuID0gRm4uaW1wb3J0VmFsdWUoYCR7cHJvcHMubmFtZX0tQmFuZFRhYmxlLUFybmApXG4gICAgLy8gY29uc3Qgc2V0TGlzdER5bmFtb0FybiA9IEZuLmltcG9ydFZhbHVlKGAke3Byb3BzLm5hbWV9LVNldExpc3RUYWJsZS1Bcm5gKVxuICAgIC8vIGNvbnN0IGphbUR5bmFtb0FybiA9IEZuLmltcG9ydFZhbHVlKGAke3Byb3BzLm5hbWV9LUphbVRhYmxlLUFybmApXG4gICAgLy8gY29uc3QgaW52aXRlRHluYW1vQXJuID0gRm4uaW1wb3J0VmFsdWUoYCR7cHJvcHMubmFtZX0tSW52aXRlVGFibGUtQXJuYClcbiAgICBcbiAgICBjb25zdCBidWNrZXRBcm4gPSBGbi5pbXBvcnRWYWx1ZShgJHtwcm9wcy5uYW1lfS1idWNrZXRBcm5gKVxuXG4gICAgY29uc3QgdXNlciA9IG5ldyBVc2VyKHRoaXMsIGAke3Byb3BzLm5hbWV9LVVzZXJgKVxuICAgIHVzZXIuYXR0YWNoSW5saW5lUG9saWN5KG5ldyBQb2xpY3kodGhpcywgYCR7cHJvcHMubmFtZX0tSW5saW5lUG9saWN5YCwge1xuICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICAvLyBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgLy8gICBhY3Rpb25zOiBbIFwiZHluYW1vZGI6KlwiIF0sXG4gICAgICAgIC8vICAgcmVzb3VyY2VzOiBbIFxuICAgICAgICAvLyAgICAgYCR7dXNlckR5bmFtb0Fybn0qYCwgYCR7YmFuZER5bmFtb0Fybn0qYCwgYCR7c29uZ0R5bmFtb0Fybn0qYCwgXG4gICAgICAgIC8vICAgICBgJHtzZXRMaXN0RHluYW1vQXJufSpgLCBgJHtqYW1EeW5hbW9Bcm59KmAsIGAke2ludml0ZUR5bmFtb0Fybn0qYFxuICAgICAgICAvLyAgIF1cbiAgICAgICAgLy8gfSksXG4gICAgICAgIG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgIHJlc291cmNlczogWyBidWNrZXRBcm4sIGAke2J1Y2tldEFybn0vKmAgXSxcbiAgICAgICAgICBhY3Rpb25zOiBbXCJzMzoqXCJdXG4gICAgICAgIH0pLFxuICAgICAgXVxuICAgIH0pKVxuXG4gICAgY29uc3QgYWNjZXNzS2V5ID0gbmV3IEFjY2Vzc0tleSh0aGlzLCBgJHtwcm9wcy5uYW1lfS1BY2Nlc3NLZXlgLCB7IHVzZXIgfSlcbiAgICBcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsIGAke3Byb3BzLm5hbWV9LUFjY2Vzc0tleS1JZGAsIHtcbiAgICAgIHZhbHVlOiBhY2Nlc3NLZXkuYWNjZXNzS2V5SWQsXG4gICAgICBleHBvcnROYW1lOiBgJHtwcm9wcy5uYW1lfS1BY2Nlc3NLZXktSWRgXG4gICAgfSlcblxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgYCR7cHJvcHMubmFtZX0tU2VjcmV0S2V5YCwge1xuICAgICAgdmFsdWU6IGFjY2Vzc0tleS5zZWNyZXRBY2Nlc3NLZXkudW5zYWZlVW53cmFwKCksXG4gICAgICBleHBvcnROYW1lOiBgJHtwcm9wcy5uYW1lfS1TZWNyZXRLZXlgXG4gICAgfSlcbiAgfVxufSJdfQ==