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
const aws_appsync_1 = require("aws-cdk-lib/aws-appsync");
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
        // The original default key (logical ID mtgstoreAppsyncGraphQLAPIDefaultApiKeyF3FEEDD7)
        // expired 2026-05-10. AppSync deleted it, and CloudFormation still tracks that logical
        // ID, so an in-place Expires update returns "API key not found". Keep this resource
        // identical to the last successful template (do not change Expires) and retain it so
        // a later removal does not call DeleteApiKey on a key that is already gone.
        // AppSync keys last at most 365 days. Before the shop key below expires, add another
        // CfnApiKey with a new construct id, point the outputs at it, and freeze the previous
        // key the same way.
        const expiredKey = appsync.resources.cfnResources.cfnApiKey;
        if (!expiredKey) {
            throw new Error('AmplifyGraphqlApi did not create the default API key');
        }
        expiredKey.expires = 1778424649;
        expiredKey.cfnOptions.deletionPolicy = aws_cdk_lib_1.CfnDeletionPolicy.RETAIN;
        expiredKey.cfnOptions.updateReplacePolicy = aws_cdk_lib_1.CfnDeletionPolicy.RETAIN;
        const apiScope = expiredKey.node.scope;
        if (!apiScope) {
            throw new Error('Default API key has no parent scope');
        }
        const hourSeconds = 60 * 60;
        const synthHour = Math.floor(Date.now() / 1000 / hourSeconds) * hourSeconds;
        // 365 days is the AppSync maximum, measured from deploy time. Stamp expiry one hour
        // under 365 days from the synth hour so a deploy shortly after synth is accepted.
        const shopKey = new aws_appsync_1.CfnApiKey(apiScope, 'ShopApiKey20261112', {
            apiId: appsync.apiId,
            description: 'Storefront API key. Rotate before it expires (365 day AppSync maximum).',
            expires: synthHour + (365 * 24 * hourSeconds) - hourSeconds,
        });
        const amplifyKeyOutput = this.node.tryFindChild('awsAppsyncApiKey');
        if (!amplifyKeyOutput) {
            throw new Error('Expected stack output awsAppsyncApiKey');
        }
        amplifyKeyOutput.value = shopKey.attrApiKey;
        new aws_cdk_lib_1.CfnOutput(this, "GraphQLAPIURL", { value: appsync.graphqlUrl });
        new aws_cdk_lib_1.CfnOutput(this, "GraphQLAPIKey", { value: shopKey.attrApiKey });
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
            // Node.js 22 does not include aws-sdk v2. Bundle @aws-sdk/* into the asset.
            bundling: { bundleAwsSDK: true },
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwc3luYy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFwcHN5bmMtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsNkNBQW9GO0FBQ3BGLHFHQUFxRztBQUNyRyx5REFBbUQ7QUFDbkQsOEVBQWdHO0FBQ2hHLGlEQUFvRztBQUNwRyx1REFBZ0Q7QUFDaEQscUVBQW1GO0FBQ25GLDZDQUFpQztBQU1qQyxNQUFhLFlBQWEsU0FBUSxtQkFBSztJQUNyQyxZQUFZLEdBQVEsRUFBRSxFQUFVLEVBQUUsS0FBbUI7UUFDbkQsS0FBSyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQTtRQUVkLE1BQU0sY0FBYyxHQUFHLGdCQUFFLENBQUMsV0FBVyxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksaUJBQWlCLENBQUMsQ0FBQTtRQUNyRSxNQUFNLGFBQWEsR0FBRyxnQkFBRSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLGdCQUFnQixDQUFDLENBQUE7UUFFbkUsTUFBTSxjQUFjLEdBQUcsZ0JBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxLQUFLLENBQUMsSUFBSSxpQkFBaUIsQ0FBQyxDQUFBO1FBQ3JFLE1BQU0sYUFBYSxHQUFHLGdCQUFFLENBQUMsV0FBVyxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksZ0JBQWdCLENBQUMsQ0FBQTtRQUVuRSxNQUFNLGtCQUFrQixHQUFHLGdCQUFFLENBQUMsV0FBVyxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUkscUJBQXFCLENBQUMsQ0FBQTtRQUM3RSxNQUFNLGlCQUFpQixHQUFHLGdCQUFFLENBQUMsV0FBVyxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksb0JBQW9CLENBQUMsQ0FBQTtRQUUzRSxNQUFNLE9BQU8sR0FBRyxJQUFJLHlDQUFpQixDQUFDLElBQUksRUFBRSxHQUFHLEtBQUssQ0FBQyxJQUFJLFVB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QUFBO1FBRUYsT0FBTyxDQUFDLG1CQUFtQixDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksaUJBQWlCLEVBQUUsYUFBYSxDQUFDO2FBQ3pFLGNBQWMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLHdCQUF3QixFQUFFO1lBQ3JELFFBQVEsRUFBRSxPQUFPO1lBQ2pCLFNBQVMsRUFBRSxlQUFlO1NBQzNCLENBQUMsQ0FBQTtJQUNKLENBQUM7Q0FDRjtBQTNJRCxvQ0EySUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBcHAsIENmbkRlbGV0aW9uUG9saWN5LCBDZm5PdXRwdXQsIER1cmF0aW9uLCBGbiwgU3RhY2sgfSBmcm9tICdhd3MtY2RrLWxpYidcbi8vIGltcG9ydCB7IEdyYXBocWxBcGksIFNjaGVtYUZpbGUsIEF1dGhvcml6YXRpb25UeXBlLCBGaWVsZExvZ0xldmVsIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwcHN5bmMnXG5pbXBvcnQgeyBDZm5BcGlLZXkgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBwc3luYydcbmltcG9ydCB7IEFtcGxpZnlHcmFwaHFsQXBpLCBBbXBsaWZ5R3JhcGhxbERlZmluaXRpb24gfSBmcm9tICdAYXdzLWFtcGxpZnkvZ3JhcGhxbC1hcGktY29uc3RydWN0J1xuaW1wb3J0IHsgTWFuYWdlZFBvbGljeSwgUG9saWN5LCBQb2xpY3lTdGF0ZW1lbnQsIFJvbGUsIFNlcnZpY2VQcmluY2lwYWwgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJ1xuaW1wb3J0IHsgUnVudGltZSB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnXG5pbXBvcnQgeyBOb2RlanNGdW5jdGlvbiwgTm9kZWpzRnVuY3Rpb25Qcm9wcyB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEtbm9kZWpzJ1xuaW1wb3J0IHBhdGgsIHsgam9pbiB9IGZyb20gJ3BhdGgnXG5cbmludGVyZmFjZSBBcHBzeW5jUHJvcHMge1xuICBuYW1lOiBzdHJpbmdcbn1cblxuZXhwb3J0IGNsYXNzIEFwcHN5bmNTdGFjayBleHRlbmRzIFN0YWNrIHtcbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIGlkOiBzdHJpbmcsIHByb3BzOiBBcHBzeW5jUHJvcHMpIHtcbiAgICBzdXBlcihhcHAsIGlkKVxuXG4gICAgY29uc3QgdXNlckR5bmFtb05hbWUgPSBGbi5pbXBvcnRWYWx1ZShgJHtwcm9wcy5uYW1lfS1Vc2VyVGFibGUtTmFtZWApXG4gICAgY29uc3QgdXNlckR5bmFtb0FybiA9IEZuLmltcG9ydFZhbHVlKGAke3Byb3BzLm5hbWV9LVVzZXJUYWJsZS1Bcm5gKVxuXG4gICAgY29uc3QgY2FyZER5bmFtb05hbWUgPSBGbi5pbXBvcnRWYWx1ZShgJHtwcm9wcy5uYW1lfS1DYXJkVGFibGUtTmFtZWApXG4gICAgY29uc3QgY2FyZER5bmFtb0FybiA9IEZuLmltcG9ydFZhbHVlKGAke3Byb3BzLm5hbWV9LUNhcmRUYWJsZS1Bcm5gKVxuXG4gICAgY29uc3QgZmlsYW1lbnREeW5hbW9OYW1lID0gRm4uaW1wb3J0VmFsdWUoYCR7cHJvcHMubmFtZX0tRmlsYW1lbnRUYWJsZS1OYW1lYClcbiAgICBjb25zdCBmaWxhbWVudER5bmFtb0FybiA9IEZuLmltcG9ydFZhbHVlKGAke3Byb3BzLm5hbWV9LUZpbGFtZW50VGFibGUtQXJuYClcblxuICAgIGNvbnN0IGFwcHN5bmMgPSBuZXcgQW1wbGlmeUdyYXBocWxBcGkodGhpcywgYCR7cHJvcHMubmFtZX0tQXBwc3luY2AsIHtcbiAgICAgIGFwaU5hbWU6IGAke3Byb3BzLm5hbWV9YCxcbiAgICAgIGRlZmluaXRpb246IEFtcGxpZnlHcmFwaHFsRGVmaW5pdGlvbi5mcm9tRmlsZXMocGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLi9cIiwgJ3NjaGVtYS5ncmFwaHFsJykpLFxuICAgICAgYXV0aG9yaXphdGlvbk1vZGVzOiB7XG4gICAgICAgIGFwaUtleUNvbmZpZzogeyBleHBpcmVzOiBEdXJhdGlvbi5kYXlzKDM2NSkgfVxuICAgICAgfVxuICAgIH0pXG5cbiAgICAvLyBUaGUgb3JpZ2luYWwgZGVmYXVsdCBrZXkgKGxvZ2ljYWwgSUQgbXRnc3RvcmVBcHBzeW5jR3JhcGhRTEFQSURlZmF1bHRBcGlLZXlGM0ZFRURENylcbiAgICAvLyBleHBpcmVkIDIwMjYtMDUtMTAuIEFwcFN5bmMgZGVsZXRlZCBpdCwgYW5kIENsb3VkRm9ybWF0aW9uIHN0aWxsIHRyYWNrcyB0aGF0IGxvZ2ljYWxcbiAgICAvLyBJRCwgc28gYW4gaW4tcGxhY2UgRXhwaXJlcyB1cGRhdGUgcmV0dXJucyBcIkFQSSBrZXkgbm90IGZvdW5kXCIuIEtlZXAgdGhpcyByZXNvdXJjZVxuICAgIC8vIGlkZW50aWNhbCB0byB0aGUgbGFzdCBzdWNjZXNzZnVsIHRlbXBsYXRlIChkbyBub3QgY2hhbmdlIEV4cGlyZXMpIGFuZCByZXRhaW4gaXQgc29cbiAgICAvLyBhIGxhdGVyIHJlbW92YWwgZG9lcyBub3QgY2FsbCBEZWxldGVBcGlLZXkgb24gYSBrZXkgdGhhdCBpcyBhbHJlYWR5IGdvbmUuXG4gICAgLy8gQXBwU3luYyBrZXlzIGxhc3QgYXQgbW9zdCAzNjUgZGF5cy4gQmVmb3JlIHRoZSBzaG9wIGtleSBiZWxvdyBleHBpcmVzLCBhZGQgYW5vdGhlclxuICAgIC8vIENmbkFwaUtleSB3aXRoIGEgbmV3IGNvbnN0cnVjdCBpZCwgcG9pbnQgdGhlIG91dHB1dHMgYXQgaXQsIGFuZCBmcmVlemUgdGhlIHByZXZpb3VzXG4gICAgLy8ga2V5IHRoZSBzYW1lIHdheS5cbiAgICBjb25zdCBleHBpcmVkS2V5ID0gYXBwc3luYy5yZXNvdXJjZXMuY2ZuUmVzb3VyY2VzLmNmbkFwaUtleVxuICAgIGlmICghZXhwaXJlZEtleSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdBbXBsaWZ5R3JhcGhxbEFwaSBkaWQgbm90IGNyZWF0ZSB0aGUgZGVmYXVsdCBBUEkga2V5JylcbiAgICB9XG4gICAgZXhwaXJlZEtleS5leHBpcmVzID0gMTc3ODQyNDY0OVxuICAgIGV4cGlyZWRLZXkuY2ZuT3B0aW9ucy5kZWxldGlvblBvbGljeSA9IENmbkRlbGV0aW9uUG9saWN5LlJFVEFJTlxuICAgIGV4cGlyZWRLZXkuY2ZuT3B0aW9ucy51cGRhdGVSZXBsYWNlUG9saWN5ID0gQ2ZuRGVsZXRpb25Qb2xpY3kuUkVUQUlOXG5cbiAgICBjb25zdCBhcGlTY29wZSA9IGV4cGlyZWRLZXkubm9kZS5zY29wZVxuICAgIGlmICghYXBpU2NvcGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRGVmYXVsdCBBUEkga2V5IGhhcyBubyBwYXJlbnQgc2NvcGUnKVxuICAgIH1cbiAgICBjb25zdCBob3VyU2Vjb25kcyA9IDYwICogNjBcbiAgICBjb25zdCBzeW50aEhvdXIgPSBNYXRoLmZsb29yKERhdGUubm93KCkgLyAxMDAwIC8gaG91clNlY29uZHMpICogaG91clNlY29uZHNcbiAgICAvLyAzNjUgZGF5cyBpcyB0aGUgQXBwU3luYyBtYXhpbXVtLCBtZWFzdXJlZCBmcm9tIGRlcGxveSB0aW1lLiBTdGFtcCBleHBpcnkgb25lIGhvdXJcbiAgICAvLyB1bmRlciAzNjUgZGF5cyBmcm9tIHRoZSBzeW50aCBob3VyIHNvIGEgZGVwbG95IHNob3J0bHkgYWZ0ZXIgc3ludGggaXMgYWNjZXB0ZWQuXG4gICAgY29uc3Qgc2hvcEtleSA9IG5ldyBDZm5BcGlLZXkoYXBpU2NvcGUsICdTaG9wQXBpS2V5MjAyNjExMTInLCB7XG4gICAgICBhcGlJZDogYXBwc3luYy5hcGlJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU3RvcmVmcm9udCBBUEkga2V5LiBSb3RhdGUgYmVmb3JlIGl0IGV4cGlyZXMgKDM2NSBkYXkgQXBwU3luYyBtYXhpbXVtKS4nLFxuICAgICAgZXhwaXJlczogc3ludGhIb3VyICsgKDM2NSAqIDI0ICogaG91clNlY29uZHMpIC0gaG91clNlY29uZHMsXG4gICAgfSlcblxuICAgIGNvbnN0IGFtcGxpZnlLZXlPdXRwdXQgPSB0aGlzLm5vZGUudHJ5RmluZENoaWxkKCdhd3NBcHBzeW5jQXBpS2V5JykgYXMgQ2ZuT3V0cHV0IHwgdW5kZWZpbmVkXG4gICAgaWYgKCFhbXBsaWZ5S2V5T3V0cHV0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIHN0YWNrIG91dHB1dCBhd3NBcHBzeW5jQXBpS2V5JylcbiAgICB9XG4gICAgYW1wbGlmeUtleU91dHB1dC52YWx1ZSA9IHNob3BLZXkuYXR0ckFwaUtleVxuXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBcIkdyYXBoUUxBUElVUkxcIiwgeyB2YWx1ZTogYXBwc3luYy5ncmFwaHFsVXJsIH0pXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBcIkdyYXBoUUxBUElLZXlcIiwgeyB2YWx1ZTogc2hvcEtleS5hdHRyQXBpS2V5IH0pXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBcIlN0YWNrIFJlZ2lvblwiLCB7IHZhbHVlOiB0aGlzLnJlZ2lvbiB9KVxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgYCR7cHJvcHMubmFtZX0tQXBwc3luY0lkYCwgeyB2YWx1ZTogYXBwc3luYy5hcGlJZCB9KVxuXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBgJHtwcm9wcy5uYW1lfS1BcHBzeW5jQXJuYCwge1xuICAgICAgdmFsdWU6IGFwcHN5bmMucmVzb3VyY2VzLmdyYXBocWxBcGkuYXJuLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvcHMubmFtZX0tQXBwc3luY0FybmBcbiAgICB9KVxuXG4gICAgY29uc3QgZXhjUm9sZSA9IG5ldyBSb2xlKHRoaXMsIGAke3Byb3BzLm5hbWV9LUFwcHN5bmNMYW1iZGFSb2xlYCwge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKVxuICAgIH0pXG5cbiAgICBleGNSb2xlLmFkZE1hbmFnZWRQb2xpY3koXG4gICAgICBNYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZShcInNlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGVcIilcbiAgICApXG5cbiAgICBleGNSb2xlLmF0dGFjaElubGluZVBvbGljeShcbiAgICAgIG5ldyBQb2xpY3kodGhpcywgYCR7cHJvcHMubmFtZX0tSW5saW5lUG9saWN5YCwge1xuICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgbmV3IFBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgIFwic2VjcmV0c21hbmFnZXI6R2V0UmVzb3VyY2VQb2xpY3lcIixcbiAgICAgICAgICAgICAgXCJzZWNyZXRzbWFuYWdlcjpHZXRTZWNyZXRWYWx1ZVwiLFxuICAgICAgICAgICAgICBcInNlY3JldHNtYW5hZ2VyOkRlc2NyaWJlU2VjcmV0XCIsXG4gICAgICAgICAgICAgIFwic2VjcmV0c21hbmFnZXI6TGlzdFNlY3JldFZlcnNpb25JZHNcIixcbiAgICAgICAgICAgICAgXCJzZWNyZXRzbWFuYWdlcjpMaXN0U2VjcmV0c1wiXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgcmVzb3VyY2VzOiBbXCIqXCJdXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbmV3IFBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICBhY3Rpb25zOiBbIFwiZHluYW1vZGI6KlwiIF0sXG4gICAgICAgICAgICByZXNvdXJjZXM6IFsgXG4gICAgICAgICAgICAgIGAke3VzZXJEeW5hbW9Bcm59KmAsIGAke2NhcmREeW5hbW9Bcm59KmAsIGAke2ZpbGFtZW50RHluYW1vQXJufSpgXG4gICAgICAgICAgICBdXG4gICAgICAgICAgfSksXG4gICAgICAgICAgbmV3IFBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICBhY3Rpb25zOiBbIFwibGFtYmRhOkludm9rZUZ1bmN0aW9uXCIgXSxcbiAgICAgICAgICAgIHJlc291cmNlczogWyBgKmAgXVxuICAgICAgICAgIH0pXG4gICAgICAgIF1cbiAgICAgIH0pXG4gICAgKVxuXG4gICAgY29uc3Qgbm9kZUpzRnVuY3Rpb25Qcm9wczogTm9kZWpzRnVuY3Rpb25Qcm9wcyA9IHtcbiAgICAgIHJvbGU6IGV4Y1JvbGUsXG4gICAgICAvLyBOb2RlLmpzIDIyIGRvZXMgbm90IGluY2x1ZGUgYXdzLXNkayB2Mi4gQnVuZGxlIEBhd3Mtc2RrLyogaW50byB0aGUgYXNzZXQuXG4gICAgICBidW5kbGluZzogeyBidW5kbGVBd3NTREs6IHRydWUgfSxcbiAgICAgIGRlcHNMb2NrRmlsZVBhdGg6IGpvaW4oX19kaXJuYW1lLCAnLi4vbGFtYmRhcycsICdwYWNrYWdlLWxvY2suanNvbicpLFxuICAgICAgZW52aXJvbm1lbnQ6IHsgXG4gICAgICAgIFVTRVJfVEFCTEVfTkFNRTogdXNlckR5bmFtb05hbWUsXG4gICAgICAgIENBUkRfVEFCTEVfTkFNRTogY2FyZER5bmFtb05hbWUsXG4gICAgICAgIEZJTEFNRU5UX1RBQkxFX05BTUU6IGZpbGFtZW50RHluYW1vTmFtZSxcbiAgICAgIH0sXG4gICAgICBydW50aW1lOiBSdW50aW1lLk5PREVKU18yMl9YLFxuICAgIH1cblxuICAgIGNvbnN0IHNlYXJjaENhcmRCeU5hbWUgPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgYCR7cHJvcHMubmFtZX0tU2VhcmNoQ2FyZEJ5TmFtZWAsIHtcbiAgICAgIGVudHJ5OiBqb2luKF9fZGlybmFtZSwgJy4uL2xhbWJkYXMnLCAnYXBwc3luYycsICdjYXJkJywgJ3NlYXJjaENhcmRCeU5hbWUudHMnKSxcbiAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAuLi5ub2RlSnNGdW5jdGlvblByb3BzXG4gICAgfSlcblxuICAgIGFwcHN5bmMuYWRkTGFtYmRhRGF0YVNvdXJjZShgJHtwcm9wcy5uYW1lfVNlYXJjaENhcmRCeU5hbWVEU2AsIHNlYXJjaENhcmRCeU5hbWUpXG4gICAgLmNyZWF0ZVJlc29sdmVyKGAke3Byb3BzLm5hbWV9LVNlYXJjaENhcmRCeU5hbWVSZXNvbHZlcmAsIHtcbiAgICAgIHR5cGVOYW1lOiBcIlF1ZXJ5XCIsXG4gICAgICBmaWVsZE5hbWU6IFwic2VhcmNoQ2FyZEJ5TmFtZVwiXG4gICAgfSlcblxuICAgIGNvbnN0IGxpc3RGaWxhbWVudHMgPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgYCR7cHJvcHMubmFtZX0tTGlzdEZpbGFtZW50c2AsIHtcbiAgICAgIGVudHJ5OiBqb2luKF9fZGlybmFtZSwgJy4uL2xhbWJkYXMnLCAnYXBwc3luYycsICdmaWxhbWVudCcsICdsaXN0RmlsYW1lbnRzLnRzJyksXG4gICAgICB0aW1lb3V0OiBEdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIC4uLm5vZGVKc0Z1bmN0aW9uUHJvcHMsXG4gICAgfSlcblxuICAgIGFwcHN5bmMuYWRkTGFtYmRhRGF0YVNvdXJjZShgJHtwcm9wcy5uYW1lfUxpc3RGaWxhbWVudHNEU2AsIGxpc3RGaWxhbWVudHMpXG4gICAgLmNyZWF0ZVJlc29sdmVyKGAke3Byb3BzLm5hbWV9LUxpc3RGaWxhbWVudHNSZXNvbHZlcmAsIHtcbiAgICAgIHR5cGVOYW1lOiBcIlF1ZXJ5XCIsXG4gICAgICBmaWVsZE5hbWU6IFwibGlzdEZpbGFtZW50c1wiXG4gICAgfSlcbiAgfVxufSJdfQ==