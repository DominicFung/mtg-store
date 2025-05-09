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
                        `${userDynamoArn}*`, `${cardDynamoArn}*`
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
    }
}
exports.AppsyncStack = AppsyncStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwc3luYy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFwcHN5bmMtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsNkNBQWlFO0FBQ2pFLHFHQUFxRztBQUNyRyw4RUFBZ0c7QUFDaEcsaURBQW9HO0FBQ3BHLHVEQUFnRDtBQUNoRCxxRUFBbUY7QUFDbkYsNkNBQWlDO0FBTWpDLE1BQWEsWUFBYSxTQUFRLG1CQUFLO0lBQ3JDLFlBQVksR0FBUSxFQUFFLEVBQVUsRUFBRSxLQUFtQjtRQUNuRCxLQUFLLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFBO1FBRWQsTUFBTSxjQUFjLEdBQUcsZ0JBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxLQUFLLENBQUMsSUFBSSxpQkFBaUIsQ0FBQyxDQUFBO1FBQ3JFLE1BQU0sYUFBYSxHQUFHLGdCQUFFLENBQUMsV0FBVyxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksZ0JBQWdCLENBQUMsQ0FBQTtRQUVuRSxNQUFNLGNBQWMsR0FBRyxnQkFBRSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLGlCQUFpQixDQUFDLENBQUE7UUFDckUsTUFBTSxhQUFhLEdBQUcsZ0JBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxLQUFLLENBQUMsSUFBSSxnQkFBZ0IsQ0FBQyxDQUFBO1FBRW5FLE1BQU0sT0FBTyxHQUFHLElBQUkseUNBQWlCLENBQUMsSUFBSSxFQUFFLEdBQUcsS0FBSyxDQUFDLElBQUksVUFBVSxFQUFFO1lBQ25FLE9BQU8sRUFBRSxHQUFHLEtBQUssQ0FBQyxJQUFJLEVBQUU7WUFDeEIsVUFBVSxFQUFFLGdEQUF3QixDQUFDLFNBQVMsQ0FBQyxjQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxLQUFLLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztZQUM3RixrQkFBa0IsRUFBRTtnQkFDbEIsWUFBWSxF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QUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDNUIsR0FBRyxtQkFBbUI7U0FDdkIsQ0FBQyxDQUFBO1FBRUYsT0FBTyxDQUFDLG1CQUFtQixDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksb0JBQW9CLEVBQUUsZ0JBQWdCLENBQUM7YUFDL0UsY0FBYyxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksMkJBQTJCLEVBQUU7WUFDeEQsUUFBUSxFQUFFLE9BQU87WUFDakIsU0FBUyxFQUFFLGtCQUFrQjtTQUM5QixDQUFDLENBQUE7SUFDSixDQUFDO0NBQ0Y7QUF0RkQsb0NBc0ZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQXBwLCBDZm5PdXRwdXQsIER1cmF0aW9uLCBGbiwgU3RhY2sgfSBmcm9tICdhd3MtY2RrLWxpYidcbi8vIGltcG9ydCB7IEdyYXBocWxBcGksIFNjaGVtYUZpbGUsIEF1dGhvcml6YXRpb25UeXBlLCBGaWVsZExvZ0xldmVsIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwcHN5bmMnXG5pbXBvcnQgeyBBbXBsaWZ5R3JhcGhxbEFwaSwgQW1wbGlmeUdyYXBocWxEZWZpbml0aW9uIH0gZnJvbSAnQGF3cy1hbXBsaWZ5L2dyYXBocWwtYXBpLWNvbnN0cnVjdCdcbmltcG9ydCB7IE1hbmFnZWRQb2xpY3ksIFBvbGljeSwgUG9saWN5U3RhdGVtZW50LCBSb2xlLCBTZXJ2aWNlUHJpbmNpcGFsIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSdcbmltcG9ydCB7IFJ1bnRpbWUgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJ1xuaW1wb3J0IHsgTm9kZWpzRnVuY3Rpb24sIE5vZGVqc0Z1bmN0aW9uUHJvcHMgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhLW5vZGVqcydcbmltcG9ydCBwYXRoLCB7IGpvaW4gfSBmcm9tICdwYXRoJ1xuXG5pbnRlcmZhY2UgQXBwc3luY1Byb3BzIHtcbiAgbmFtZTogc3RyaW5nXG59XG5cbmV4cG9ydCBjbGFzcyBBcHBzeW5jU3RhY2sgZXh0ZW5kcyBTdGFjayB7XG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBpZDogc3RyaW5nLCBwcm9wczogQXBwc3luY1Byb3BzKSB7XG4gICAgc3VwZXIoYXBwLCBpZClcblxuICAgIGNvbnN0IHVzZXJEeW5hbW9OYW1lID0gRm4uaW1wb3J0VmFsdWUoYCR7cHJvcHMubmFtZX0tVXNlclRhYmxlLU5hbWVgKVxuICAgIGNvbnN0IHVzZXJEeW5hbW9Bcm4gPSBGbi5pbXBvcnRWYWx1ZShgJHtwcm9wcy5uYW1lfS1Vc2VyVGFibGUtQXJuYClcblxuICAgIGNvbnN0IGNhcmREeW5hbW9OYW1lID0gRm4uaW1wb3J0VmFsdWUoYCR7cHJvcHMubmFtZX0tQ2FyZFRhYmxlLU5hbWVgKVxuICAgIGNvbnN0IGNhcmREeW5hbW9Bcm4gPSBGbi5pbXBvcnRWYWx1ZShgJHtwcm9wcy5uYW1lfS1DYXJkVGFibGUtQXJuYClcblxuICAgIGNvbnN0IGFwcHN5bmMgPSBuZXcgQW1wbGlmeUdyYXBocWxBcGkodGhpcywgYCR7cHJvcHMubmFtZX0tQXBwc3luY2AsIHtcbiAgICAgIGFwaU5hbWU6IGAke3Byb3BzLm5hbWV9YCxcbiAgICAgIGRlZmluaXRpb246IEFtcGxpZnlHcmFwaHFsRGVmaW5pdGlvbi5mcm9tRmlsZXMocGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLi9cIiwgJ3NjaGVtYS5ncmFwaHFsJykpLFxuICAgICAgYXV0aG9yaXphdGlvbk1vZGVzOiB7XG4gICAgICAgIGFwaUtleUNvbmZpZzogeyBleHBpcmVzOiBEdXJhdGlvbi5kYXlzKDM2NSkgfVxuICAgICAgfVxuICAgIH0pXG5cbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsIFwiR3JhcGhRTEFQSVVSTFwiLCB7IHZhbHVlOiBhcHBzeW5jLmdyYXBocWxVcmwgfSlcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsIFwiR3JhcGhRTEFQSUtleVwiLCB7IHZhbHVlOiBhcHBzeW5jLmFwaUtleSB8fCAnJyB9KVxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgXCJTdGFjayBSZWdpb25cIiwgeyB2YWx1ZTogdGhpcy5yZWdpb24gfSlcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsIGAke3Byb3BzLm5hbWV9LUFwcHN5bmNJZGAsIHsgdmFsdWU6IGFwcHN5bmMuYXBpSWQgfSlcblxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgYCR7cHJvcHMubmFtZX0tQXBwc3luY0FybmAsIHtcbiAgICAgIHZhbHVlOiBhcHBzeW5jLnJlc291cmNlcy5ncmFwaHFsQXBpLmFybixcbiAgICAgIGV4cG9ydE5hbWU6IGAke3Byb3BzLm5hbWV9LUFwcHN5bmNBcm5gXG4gICAgfSlcblxuICAgIGNvbnN0IGV4Y1JvbGUgPSBuZXcgUm9sZSh0aGlzLCBgJHtwcm9wcy5uYW1lfS1BcHBzeW5jTGFtYmRhUm9sZWAsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IFNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJylcbiAgICB9KVxuXG4gICAgZXhjUm9sZS5hZGRNYW5hZ2VkUG9saWN5KFxuICAgICAgTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoXCJzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlXCIpXG4gICAgKVxuXG4gICAgZXhjUm9sZS5hdHRhY2hJbmxpbmVQb2xpY3koXG4gICAgICBuZXcgUG9saWN5KHRoaXMsIGAke3Byb3BzLm5hbWV9LUlubGluZVBvbGljeWAsIHtcbiAgICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICAgIG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICBcInNlY3JldHNtYW5hZ2VyOkdldFJlc291cmNlUG9saWN5XCIsXG4gICAgICAgICAgICAgIFwic2VjcmV0c21hbmFnZXI6R2V0U2VjcmV0VmFsdWVcIixcbiAgICAgICAgICAgICAgXCJzZWNyZXRzbWFuYWdlcjpEZXNjcmliZVNlY3JldFwiLFxuICAgICAgICAgICAgICBcInNlY3JldHNtYW5hZ2VyOkxpc3RTZWNyZXRWZXJzaW9uSWRzXCIsXG4gICAgICAgICAgICAgIFwic2VjcmV0c21hbmFnZXI6TGlzdFNlY3JldHNcIlxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIHJlc291cmNlczogW1wiKlwiXVxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgYWN0aW9uczogWyBcImR5bmFtb2RiOipcIiBdLFxuICAgICAgICAgICAgcmVzb3VyY2VzOiBbIFxuICAgICAgICAgICAgICBgJHt1c2VyRHluYW1vQXJufSpgLCBgJHtjYXJkRHluYW1vQXJufSpgXG4gICAgICAgICAgICBdXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbmV3IFBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICBhY3Rpb25zOiBbIFwibGFtYmRhOkludm9rZUZ1bmN0aW9uXCIgXSxcbiAgICAgICAgICAgIHJlc291cmNlczogWyBgKmAgXVxuICAgICAgICAgIH0pXG4gICAgICAgIF1cbiAgICAgIH0pXG4gICAgKVxuXG4gICAgY29uc3Qgbm9kZUpzRnVuY3Rpb25Qcm9wczogTm9kZWpzRnVuY3Rpb25Qcm9wcyA9IHtcbiAgICAgIHJvbGU6IGV4Y1JvbGUsXG4gICAgICBidW5kbGluZzogeyBleHRlcm5hbE1vZHVsZXM6IFsnYXdzLXNkayddIH0sXG4gICAgICBkZXBzTG9ja0ZpbGVQYXRoOiBqb2luKF9fZGlybmFtZSwgJy4uL2xhbWJkYXMnLCAncGFja2FnZS1sb2NrLmpzb24nKSxcbiAgICAgIGVudmlyb25tZW50OiB7IFxuICAgICAgICBVU0VSX1RBQkxFX05BTUU6IHVzZXJEeW5hbW9OYW1lLFxuICAgICAgICBDQVJEX1RBQkxFX05BTUU6IGNhcmREeW5hbW9OYW1lLFxuICAgICAgfSxcbiAgICAgIHJ1bnRpbWU6IFJ1bnRpbWUuTk9ERUpTXzIyX1gsXG4gICAgfVxuXG4gICAgY29uc3Qgc2VhcmNoQ2FyZEJ5TmFtZSA9IG5ldyBOb2RlanNGdW5jdGlvbih0aGlzLCBgJHtwcm9wcy5uYW1lfS1TZWFyY2hDYXJkQnlOYW1lYCwge1xuICAgICAgZW50cnk6IGpvaW4oX19kaXJuYW1lLCAnLi4vbGFtYmRhcycsICdhcHBzeW5jJywgJ2NhcmQnLCAnc2VhcmNoQ2FyZEJ5TmFtZS50cycpLFxuICAgICAgdGltZW91dDogRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIC4uLm5vZGVKc0Z1bmN0aW9uUHJvcHNcbiAgICB9KVxuXG4gICAgYXBwc3luYy5hZGRMYW1iZGFEYXRhU291cmNlKGAke3Byb3BzLm5hbWV9U2VhcmNoQ2FyZEJ5TmFtZURTYCwgc2VhcmNoQ2FyZEJ5TmFtZSlcbiAgICAuY3JlYXRlUmVzb2x2ZXIoYCR7cHJvcHMubmFtZX0tU2VhcmNoQ2FyZEJ5TmFtZVJlc29sdmVyYCwge1xuICAgICAgdHlwZU5hbWU6IFwiUXVlcnlcIixcbiAgICAgIGZpZWxkTmFtZTogXCJzZWFyY2hDYXJkQnlOYW1lXCJcbiAgICB9KVxuICB9XG59Il19