"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppsyncStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
// import { GraphqlApi, SchemaFile, AuthorizationType, FieldLogLevel } from 'aws-cdk-lib/aws-appsync'
const graphql_api_construct_1 = require("@aws-amplify/graphql-api-construct");
const aws_iam_1 = require("aws-cdk-lib/aws-iam");
const aws_lambda_1 = require("aws-cdk-lib/aws-lambda");
const aws_lambda_nodejs_1 = require("aws-cdk-lib/aws-lambda-nodejs");
const path_1 = __importStar(require("path"));
class AppsyncStack extends aws_cdk_lib_1.Stack {
    constructor(app, id, props) {
        super(app, id);
        const userDynamoName = aws_cdk_lib_1.Fn.importValue(`${props.name}-UserTable-Name`);
        const userDynamoArn = aws_cdk_lib_1.Fn.importValue(`${props.name}-UserTable-Arn`);
        const cardDynamoName = aws_cdk_lib_1.Fn.importValue(`${props.name}-CardTable-Name`);
        const cardDynamoArn = aws_cdk_lib_1.Fn.importValue(`${props.name}-CardTable-Arn`);
        const filamentDynamoName = aws_cdk_lib_1.Fn.importValue(`${props.name}-FilamentTable-Name`);
        const filamentDynamoArn = aws_cdk_lib_1.Fn.importValue(`${props.name}-FilamentTable-Arn`);
        const appsync = new graphql_api_construct_1.AmplifyGraphqlApi(this, `${props.name}-Appsync`, {
            apiName: `${props.name}`,
            definition: graphql_api_construct_1.AmplifyGraphqlDefinition.fromFiles(path_1.default.join(__dirname, "../", 'schema.graphql')),
            authorizationModes: {
                apiKeyConfig: { expires: aws_cdk_lib_1.Duration.days(365) }
            }
        });
        new aws_cdk_lib_1.CfnOutput(this, "GraphQLAPIURL", { value: appsync.graphqlUrl });
        new aws_cdk_lib_1.CfnOutput(this, "GraphQLAPIKey", { value: appsync.apiKey || '' });
        new aws_cdk_lib_1.CfnOutput(this, "Stack Region", { value: this.region });
        new aws_cdk_lib_1.CfnOutput(this, `${props.name}-AppsyncId`, { value: appsync.apiId });
        new aws_cdk_lib_1.CfnOutput(this, `${props.name}-AppsyncArn`, {
            value: appsync.resources.graphqlApi.arn,
            exportName: `${props.name}-AppsyncArn`
        });
        const excRole = new aws_iam_1.Role(this, `${props.name}-AppsyncLambdaRole`, {
            assumedBy: new aws_iam_1.ServicePrincipal('lambda.amazonaws.com')
        });
        excRole.addManagedPolicy(aws_iam_1.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"));
        excRole.attachInlinePolicy(new aws_iam_1.Policy(this, `${props.name}-InlinePolicy`, {
            statements: [
                new aws_iam_1.PolicyStatement({
                    actions: [
                        "secretsmanager:GetResourcePolicy",
                        "secretsmanager:GetSecretValue",
                        "secretsmanager:DescribeSecret",
                        "secretsmanager:ListSecretVersionIds",
                        "secretsmanager:ListSecrets"
                    ],
                    resources: ["*"]
                }),
                new aws_iam_1.PolicyStatement({
                    actions: ["dynamodb:*"],
                    resources: [
                        `${userDynamoArn}*`, `${cardDynamoArn}*`, `${filamentDynamoArn}*`
                    ]
                }),
                new aws_iam_1.PolicyStatement({
                    actions: ["lambda:InvokeFunction"],
                    resources: [`*`]
                })
            ]
        }));
        const nodeJsFunctionProps = {
            role: excRole,
            bundling: { externalModules: ['aws-sdk'] },
            depsLockFilePath: (0, path_1.join)(__dirname, '../lambdas', 'package-lock.json'),
            environment: {
                USER_TABLE_NAME: userDynamoName,
                CARD_TABLE_NAME: cardDynamoName,
                FILAMENT_TABLE_NAME: filamentDynamoName,
            },
            runtime: aws_lambda_1.Runtime.NODEJS_22_X,
        };
        const searchCardByName = new aws_lambda_nodejs_1.NodejsFunction(this, `${props.name}-SearchCardByName`, {
            entry: (0, path_1.join)(__dirname, '../lambdas', 'appsync', 'card', 'searchCardByName.ts'),
            timeout: aws_cdk_lib_1.Duration.minutes(5),
            ...nodeJsFunctionProps
        });
        appsync.addLambdaDataSource(`${props.name}SearchCardByNameDS`, searchCardByName)
            .createResolver(`${props.name}-SearchCardByNameResolver`, {
            typeName: "Query",
            fieldName: "searchCardByName"
        });
        const listFilaments = new aws_lambda_nodejs_1.NodejsFunction(this, `${props.name}-ListFilaments`, {
            entry: (0, path_1.join)(__dirname, '../lambdas', 'appsync', 'filament', 'listFilaments.ts'),
            timeout: aws_cdk_lib_1.Duration.seconds(30),
            ...nodeJsFunctionProps,
        });
        appsync.addLambdaDataSource(`${props.name}ListFilamentsDS`, listFilaments)
            .createResolver(`${props.name}-ListFilamentsResolver`, {
            typeName: "Query",
            fieldName: "listFilaments"
        });
    }
}
exports.AppsyncStack = AppsyncStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwc3luYy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFwcHN5bmMtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsNkNBQWlFO0FBQ2pFLHFHQUFxRztBQUNyRyw4RUFBZ0c7QUFDaEcsaURBQW9HO0FBQ3BHLHVEQUFnRDtBQUNoRCxxRUFBbUY7QUFDbkYsNkNBQWlDO0FBTWpDLE1BQWEsWUFBYSxTQUFRLG1CQUFLO0lBQ3JDLFlBQVksR0FBUSxFQUFFLEVBQVUsRUFBRSxLQUFtQjtRQUNuRCxLQUFLLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFBO1FBRWQsTUFBTSxjQUFjLEdBQUcsZ0JBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxLQUFLLENBQUMsSUFBSSxpQkFBaUIsQ0FBQyxDQUFBO1FBQ3JFLE1BQU0sYUFBYSxHQUFHLGdCQUFFLENBQUMsV0FBVyxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksZ0JBQWdCLENBQUMsQ0FBQTtRQUVuRSxNQUFNLGNBQWMsR0FBRyxnQkFBRSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLGlCQUFpQixDQUFDLENBQUE7UUFDckUsTUFBTSxhQUFhLEdBQUcsZ0JBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxLQUFLLENBQUMsSUFBSSxnQkFBZ0IsQ0FBQyxDQUFBO1FBRW5FLE1BQU0sa0JBQWtCLEdBQUcsZ0JBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxLQUFLLENBQUMsSUFBSSxxQkFBcUIsQ0FBQyxDQUFBO1FBQzdFLE1BQU0saUJBQWlCLEdBQUcsZ0JBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxLQUFLLENBQUMsSUFBSSxvQkFBb0IsQ0FBQyxDQUFBO1FBRTNFLE1BQU0sT0FBTyxHQUFHLElBQUkseUNBQWlCLENBQUMsSUFBSSxFQUFFLEdBQUcsS0FBSyxDQUFDLElBQUksVUFBVSxFQUFFO1lBQ25F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c0NvbnRlbnQiOlsiaW1wb3J0IHsgQXBwLCBDZm5PdXRwdXQsIER1cmF0aW9uLCBGbiwgU3RhY2sgfSBmcm9tICdhd3MtY2RrLWxpYidcbi8vIGltcG9ydCB7IEdyYXBocWxBcGksIFNjaGVtYUZpbGUsIEF1dGhvcml6YXRpb25UeXBlLCBGaWVsZExvZ0xldmVsIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwcHN5bmMnXG5pbXBvcnQgeyBBbXBsaWZ5R3JhcGhxbEFwaSwgQW1wbGlmeUdyYXBocWxEZWZpbml0aW9uIH0gZnJvbSAnQGF3cy1hbXBsaWZ5L2dyYXBocWwtYXBpLWNvbnN0cnVjdCdcbmltcG9ydCB7IE1hbmFnZWRQb2xpY3ksIFBvbGljeSwgUG9saWN5U3RhdGVtZW50LCBSb2xlLCBTZXJ2aWNlUHJpbmNpcGFsIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSdcbmltcG9ydCB7IFJ1bnRpbWUgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJ1xuaW1wb3J0IHsgTm9kZWpzRnVuY3Rpb24sIE5vZGVqc0Z1bmN0aW9uUHJvcHMgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhLW5vZGVqcydcbmltcG9ydCBwYXRoLCB7IGpvaW4gfSBmcm9tICdwYXRoJ1xuXG5pbnRlcmZhY2UgQXBwc3luY1Byb3BzIHtcbiAgbmFtZTogc3RyaW5nXG59XG5cbmV4cG9ydCBjbGFzcyBBcHBzeW5jU3RhY2sgZXh0ZW5kcyBTdGFjayB7XG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBpZDogc3RyaW5nLCBwcm9wczogQXBwc3luY1Byb3BzKSB7XG4gICAgc3VwZXIoYXBwLCBpZClcblxuICAgIGNvbnN0IHVzZXJEeW5hbW9OYW1lID0gRm4uaW1wb3J0VmFsdWUoYCR7cHJvcHMubmFtZX0tVXNlclRhYmxlLU5hbWVgKVxuICAgIGNvbnN0IHVzZXJEeW5hbW9Bcm4gPSBGbi5pbXBvcnRWYWx1ZShgJHtwcm9wcy5uYW1lfS1Vc2VyVGFibGUtQXJuYClcblxuICAgIGNvbnN0IGNhcmREeW5hbW9OYW1lID0gRm4uaW1wb3J0VmFsdWUoYCR7cHJvcHMubmFtZX0tQ2FyZFRhYmxlLU5hbWVgKVxuICAgIGNvbnN0IGNhcmREeW5hbW9Bcm4gPSBGbi5pbXBvcnRWYWx1ZShgJHtwcm9wcy5uYW1lfS1DYXJkVGFibGUtQXJuYClcblxuICAgIGNvbnN0IGZpbGFtZW50RHluYW1vTmFtZSA9IEZuLmltcG9ydFZhbHVlKGAke3Byb3BzLm5hbWV9LUZpbGFtZW50VGFibGUtTmFtZWApXG4gICAgY29uc3QgZmlsYW1lbnREeW5hbW9Bcm4gPSBGbi5pbXBvcnRWYWx1ZShgJHtwcm9wcy5uYW1lfS1GaWxhbWVudFRhYmxlLUFybmApXG5cbiAgICBjb25zdCBhcHBzeW5jID0gbmV3IEFtcGxpZnlHcmFwaHFsQXBpKHRoaXMsIGAke3Byb3BzLm5hbWV9LUFwcHN5bmNgLCB7XG4gICAgICBhcGlOYW1lOiBgJHtwcm9wcy5uYW1lfWAsXG4gICAgICBkZWZpbml0aW9uOiBBbXBsaWZ5R3JhcGhxbERlZmluaXRpb24uZnJvbUZpbGVzKHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vXCIsICdzY2hlbWEuZ3JhcGhxbCcpKSxcbiAgICAgIGF1dGhvcml6YXRpb25Nb2Rlczoge1xuICAgICAgICBhcGlLZXlDb25maWc6IHsgZXhwaXJlczogRHVyYXRpb24uZGF5cygzNjUpIH1cbiAgICAgIH1cbiAgICB9KVxuXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBcIkdyYXBoUUxBUElVUkxcIiwgeyB2YWx1ZTogYXBwc3luYy5ncmFwaHFsVXJsIH0pXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBcIkdyYXBoUUxBUElLZXlcIiwgeyB2YWx1ZTogYXBwc3luYy5hcGlLZXkgfHwgJycgfSlcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsIFwiU3RhY2sgUmVnaW9uXCIsIHsgdmFsdWU6IHRoaXMucmVnaW9uIH0pXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBgJHtwcm9wcy5uYW1lfS1BcHBzeW5jSWRgLCB7IHZhbHVlOiBhcHBzeW5jLmFwaUlkIH0pXG5cbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsIGAke3Byb3BzLm5hbWV9LUFwcHN5bmNBcm5gLCB7XG4gICAgICB2YWx1ZTogYXBwc3luYy5yZXNvdXJjZXMuZ3JhcGhxbEFwaS5hcm4sXG4gICAgICBleHBvcnROYW1lOiBgJHtwcm9wcy5uYW1lfS1BcHBzeW5jQXJuYFxuICAgIH0pXG5cbiAgICBjb25zdCBleGNSb2xlID0gbmV3IFJvbGUodGhpcywgYCR7cHJvcHMubmFtZX0tQXBwc3luY0xhbWJkYVJvbGVgLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBTZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpXG4gICAgfSlcblxuICAgIGV4Y1JvbGUuYWRkTWFuYWdlZFBvbGljeShcbiAgICAgIE1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKFwic2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZVwiKVxuICAgIClcblxuICAgIGV4Y1JvbGUuYXR0YWNoSW5saW5lUG9saWN5KFxuICAgICAgbmV3IFBvbGljeSh0aGlzLCBgJHtwcm9wcy5uYW1lfS1JbmxpbmVQb2xpY3lgLCB7XG4gICAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgXCJzZWNyZXRzbWFuYWdlcjpHZXRSZXNvdXJjZVBvbGljeVwiLFxuICAgICAgICAgICAgICBcInNlY3JldHNtYW5hZ2VyOkdldFNlY3JldFZhbHVlXCIsXG4gICAgICAgICAgICAgIFwic2VjcmV0c21hbmFnZXI6RGVzY3JpYmVTZWNyZXRcIixcbiAgICAgICAgICAgICAgXCJzZWNyZXRzbWFuYWdlcjpMaXN0U2VjcmV0VmVyc2lvbklkc1wiLFxuICAgICAgICAgICAgICBcInNlY3JldHNtYW5hZ2VyOkxpc3RTZWNyZXRzXCJcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICByZXNvdXJjZXM6IFtcIipcIl1cbiAgICAgICAgICB9KSxcbiAgICAgICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgIGFjdGlvbnM6IFsgXCJkeW5hbW9kYjoqXCIgXSxcbiAgICAgICAgICAgIHJlc291cmNlczogWyBcbiAgICAgICAgICAgICAgYCR7dXNlckR5bmFtb0Fybn0qYCwgYCR7Y2FyZER5bmFtb0Fybn0qYCwgYCR7ZmlsYW1lbnREeW5hbW9Bcm59KmBcbiAgICAgICAgICAgIF1cbiAgICAgICAgICB9KSxcbiAgICAgICAgICBuZXcgUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgIGFjdGlvbnM6IFsgXCJsYW1iZGE6SW52b2tlRnVuY3Rpb25cIiBdLFxuICAgICAgICAgICAgcmVzb3VyY2VzOiBbIGAqYCBdXG4gICAgICAgICAgfSlcbiAgICAgICAgXVxuICAgICAgfSlcbiAgICApXG5cbiAgICBjb25zdCBub2RlSnNGdW5jdGlvblByb3BzOiBOb2RlanNGdW5jdGlvblByb3BzID0ge1xuICAgICAgcm9sZTogZXhjUm9sZSxcbiAgICAgIGJ1bmRsaW5nOiB7IGV4dGVybmFsTW9kdWxlczogWydhd3Mtc2RrJ10gfSxcbiAgICAgIGRlcHNMb2NrRmlsZVBhdGg6IGpvaW4oX19kaXJuYW1lLCAnLi4vbGFtYmRhcycsICdwYWNrYWdlLWxvY2suanNvbicpLFxuICAgICAgZW52aXJvbm1lbnQ6IHsgXG4gICAgICAgIFVTRVJfVEFCTEVfTkFNRTogdXNlckR5bmFtb05hbWUsXG4gICAgICAgIENBUkRfVEFCTEVfTkFNRTogY2FyZER5bmFtb05hbWUsXG4gICAgICAgIEZJTEFNRU5UX1RBQkxFX05BTUU6IGZpbGFtZW50RHluYW1vTmFtZSxcbiAgICAgIH0sXG4gICAgICBydW50aW1lOiBSdW50aW1lLk5PREVKU18yMl9YLFxuICAgIH1cblxuICAgIGNvbnN0IHNlYXJjaENhcmRCeU5hbWUgPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgYCR7cHJvcHMubmFtZX0tU2VhcmNoQ2FyZEJ5TmFtZWAsIHtcbiAgICAgIGVudHJ5OiBqb2luKF9fZGlybmFtZSwgJy4uL2xhbWJkYXMnLCAnYXBwc3luYycsICdjYXJkJywgJ3NlYXJjaENhcmRCeU5hbWUudHMnKSxcbiAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAuLi5ub2RlSnNGdW5jdGlvblByb3BzXG4gICAgfSlcblxuICAgIGFwcHN5bmMuYWRkTGFtYmRhRGF0YVNvdXJjZShgJHtwcm9wcy5uYW1lfVNlYXJjaENhcmRCeU5hbWVEU2AsIHNlYXJjaENhcmRCeU5hbWUpXG4gICAgLmNyZWF0ZVJlc29sdmVyKGAke3Byb3BzLm5hbWV9LVNlYXJjaENhcmRCeU5hbWVSZXNvbHZlcmAsIHtcbiAgICAgIHR5cGVOYW1lOiBcIlF1ZXJ5XCIsXG4gICAgICBmaWVsZE5hbWU6IFwic2VhcmNoQ2FyZEJ5TmFtZVwiXG4gICAgfSlcblxuICAgIGNvbnN0IGxpc3RGaWxhbWVudHMgPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgYCR7cHJvcHMubmFtZX0tTGlzdEZpbGFtZW50c2AsIHtcbiAgICAgIGVudHJ5OiBqb2luKF9fZGlybmFtZSwgJy4uL2xhbWJkYXMnLCAnYXBwc3luYycsICdmaWxhbWVudCcsICdsaXN0RmlsYW1lbnRzLnRzJyksXG4gICAgICB0aW1lb3V0OiBEdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIC4uLm5vZGVKc0Z1bmN0aW9uUHJvcHMsXG4gICAgfSlcblxuICAgIGFwcHN5bmMuYWRkTGFtYmRhRGF0YVNvdXJjZShgJHtwcm9wcy5uYW1lfUxpc3RGaWxhbWVudHNEU2AsIGxpc3RGaWxhbWVudHMpXG4gICAgLmNyZWF0ZVJlc29sdmVyKGAke3Byb3BzLm5hbWV9LUxpc3RGaWxhbWVudHNSZXNvbHZlcmAsIHtcbiAgICAgIHR5cGVOYW1lOiBcIlF1ZXJ5XCIsXG4gICAgICBmaWVsZE5hbWU6IFwibGlzdEZpbGFtZW50c1wiXG4gICAgfSlcbiAgfVxufSJdfQ==