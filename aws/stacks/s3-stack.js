"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3Stack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const aws_s3_1 = require("aws-cdk-lib/aws-s3");
class S3Stack extends aws_cdk_lib_1.Stack {
    constructor(app, id, props) {
        super(app, id);
        console.log(props);
        const s3 = new aws_s3_1.Bucket(this, `${props.name}-Bucket`, {
            blockPublicAccess: {
                blockPublicAcls: false,
                blockPublicPolicy: false,
                ignorePublicAcls: false,
                restrictPublicBuckets: false
            },
            autoDeleteObjects: true,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            objectOwnership: aws_s3_1.ObjectOwnership.OBJECT_WRITER,
            cors: [{
                    allowedMethods: [aws_s3_1.HttpMethods.GET, aws_s3_1.HttpMethods.POST, aws_s3_1.HttpMethods.PUT,],
                    allowedOrigins: ['*'],
                    allowedHeaders: ['*'],
                }],
            // https://stackoverflow.com/questions/76097031/aws-s3-bucket-cannot-have-acls-set-with-objectownerships-bucketownerenforced-s
            // accessControl: BucketAccessControl.PUBLIC_READ,
            publicReadAccess: true
        });
        new aws_cdk_lib_1.CfnOutput(this, 'bucketName', {
            value: s3.bucketName,
            exportName: `${props.name}-bucketName`
        });
        new aws_cdk_lib_1.CfnOutput(this, 'bucketArn', {
            value: s3.bucketArn,
            exportName: `${props.name}-bucketArn`
        });
    }
}
exports.S3Stack = S3Stack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiczMtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzMy1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw2Q0FBa0U7QUFDbEUsK0NBQTRGO0FBTTVGLE1BQWEsT0FBUSxTQUFRLG1CQUFLO0lBQ2hDLFlBQVksR0FBUSxFQUFFLEVBQVUsRUFBRSxLQUFjO1FBQzlDLEtBQUssQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUE7UUFDZCxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFBO1FBRWxCLE1BQU0sRUFBRSxHQUFHLElBQUksZUFBTSxDQUFDLElBQUksRUFBRSxHQUFHLEtBQUssQ0FBQyxJQUFJLFNBQVMsRUFBRTtZQUNsRCxpQkFBaUIsRUFBRTtnQkFDakIsZUFBZSxFQUFFLEtBQUs7Z0JBQ3RCLGlCQUFpQixFQUFFLEtBQUs7Z0JBQ3hCLGdCQUFnQixFQUFFLEtBQUs7Z0JBQ3ZCLHFCQUFxQixFQUFFLEtBQUs7YUFDUjtZQUN0QixpQkFBaUIsRUFBRSxJQUFJO1lBQ3ZCLGFBQWEsRUFBRSwyQkFBYSxDQUFDLE9BQU87WUFDcEMsZUFBZSxFQUFFLHdCQUFlLENBQUMsYUFBYTtZQUM5QyxJQUFJLEVBQUUsQ0FBQztvQkFDSCxjQUFjLEVBQUUsQ0FBQyxvQkFBVyxDQUFDLEdBQUcsRUFBRSxvQkFBVyxDQUFDLElBQUksRUFBRSxvQkFBVyxDQUFDLEdBQUcsRUFBRTtvQkFDckUsY0FBYyxFQUFFLENBQUMsR0FBRyxDQUFDO29CQUNyQixjQUFjLEVBQUUsQ0FBQyxHQUFHLENBQUM7aUJBQ3RCLENBQUM7WUFDSiw4SEFBOEg7WUFDOUgsa0RBQWtEO1lBQ2xELGdCQUFnQixFQUFFLElBQUk7U0FDdkIsQ0FBQyxDQUFBO1FBRUYsSUFBSSx1QkFBUyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDaEMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxVQUFVO1lBQ3BCLFVBQVUsRUFBRSxHQUFHLEtBQUssQ0FBQyxJQUFJLGFBQWE7U0FDdkMsQ0FBQyxDQUFBO1FBRUYsSUFBSSx1QkFBUyxDQUFDLElBQUksRUFBRSxXQUFXLEVBQUU7WUFDL0IsS0FBSyxFQUFFLEVBQUUsQ0FBQyxTQUFTO1lBQ25CLFVBQVUsRUFBRSxHQUFHLEtBQUssQ0FBQyxJQUFJLFlBQVk7U0FDdEMsQ0FBQyxDQUFBO0lBQ0osQ0FBQztDQUNGO0FBbkNELDBCQW1DQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFwcCwgQ2ZuT3V0cHV0LCBTdGFjaywgUmVtb3ZhbFBvbGljeSB9IGZyb20gJ2F3cy1jZGstbGliJ1xuaW1wb3J0IHsgQmxvY2tQdWJsaWNBY2Nlc3MsIEJ1Y2tldCwgSHR0cE1ldGhvZHMsIE9iamVjdE93bmVyc2hpcCB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMydcblxuaW50ZXJmYWNlIFMzUHJvcHMge1xuICBuYW1lOiBzdHJpbmdcbn1cblxuZXhwb3J0IGNsYXNzIFMzU3RhY2sgZXh0ZW5kcyBTdGFjayB7XG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBpZDogc3RyaW5nLCBwcm9wczogUzNQcm9wcykge1xuICAgIHN1cGVyKGFwcCwgaWQpXG4gICAgY29uc29sZS5sb2cocHJvcHMpXG5cbiAgICBjb25zdCBzMyA9IG5ldyBCdWNrZXQodGhpcywgYCR7cHJvcHMubmFtZX0tQnVja2V0YCwge1xuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHtcbiAgICAgICAgYmxvY2tQdWJsaWNBY2xzOiBmYWxzZSxcbiAgICAgICAgYmxvY2tQdWJsaWNQb2xpY3k6IGZhbHNlLFxuICAgICAgICBpZ25vcmVQdWJsaWNBY2xzOiBmYWxzZSxcbiAgICAgICAgcmVzdHJpY3RQdWJsaWNCdWNrZXRzOiBmYWxzZVxuICAgICAgfSBhcyBCbG9ja1B1YmxpY0FjY2VzcyxcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLFxuICAgICAgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgb2JqZWN0T3duZXJzaGlwOiBPYmplY3RPd25lcnNoaXAuT0JKRUNUX1dSSVRFUixcbiAgICAgIGNvcnM6IFt7XG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtIdHRwTWV0aG9kcy5HRVQsIEh0dHBNZXRob2RzLlBPU1QsIEh0dHBNZXRob2RzLlBVVCxdLFxuICAgICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgIH1dLFxuICAgICAgLy8gaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvNzYwOTcwMzEvYXdzLXMzLWJ1Y2tldC1jYW5ub3QtaGF2ZS1hY2xzLXNldC13aXRoLW9iamVjdG93bmVyc2hpcHMtYnVja2V0b3duZXJlbmZvcmNlZC1zXG4gICAgICAvLyBhY2Nlc3NDb250cm9sOiBCdWNrZXRBY2Nlc3NDb250cm9sLlBVQkxJQ19SRUFELFxuICAgICAgcHVibGljUmVhZEFjY2VzczogdHJ1ZVxuICAgIH0pXG5cbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdidWNrZXROYW1lJywge1xuICAgICAgdmFsdWU6IHMzLmJ1Y2tldE5hbWUsXG4gICAgICBleHBvcnROYW1lOiBgJHtwcm9wcy5uYW1lfS1idWNrZXROYW1lYFxuICAgIH0pXG5cbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdidWNrZXRBcm4nLCB7XG4gICAgICB2YWx1ZTogczMuYnVja2V0QXJuLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvcHMubmFtZX0tYnVja2V0QXJuYFxuICAgIH0pXG4gIH1cbn0iXX0=