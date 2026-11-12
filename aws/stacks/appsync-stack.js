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
        // New table only. The existing lambda role is left unchanged.
        const printSettingsDynamoName = aws_cdk_lib_1.Fn.importValue(`${props.name}-PrintSettingsTable-Name`);
        const printSettingsDynamoArn = aws_cdk_lib_1.Fn.importValue(`${props.name}-PrintSettingsTable-Arn`);
        const printSettingsRole = new aws_iam_1.Role(this, `${props.name}-PrintSettingsLambdaRole`, {
            assumedBy: new aws_iam_1.ServicePrincipal('lambda.amazonaws.com'),
        });
        printSettingsRole.addManagedPolicy(aws_iam_1.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'));
        printSettingsRole.addToPolicy(new aws_iam_1.PolicyStatement({
            actions: ['dynamodb:GetItem', 'dynamodb:PutItem'],
            resources: [printSettingsDynamoArn],
        }));
        const getPrintSettings = new aws_lambda_nodejs_1.NodejsFunction(this, `${props.name}-GetPrintSettings`, {
            entry: (0, path_1.join)(__dirname, '../lambdas', 'appsync', 'printSettings', 'getPrintSettings.ts'),
            timeout: aws_cdk_lib_1.Duration.seconds(30),
            role: printSettingsRole,
            bundling: { externalModules: ['aws-sdk'] },
            depsLockFilePath: (0, path_1.join)(__dirname, '../lambdas', 'package-lock.json'),
            environment: {
                PRINT_SETTINGS_TABLE_NAME: printSettingsDynamoName,
            },
            runtime: aws_lambda_1.Runtime.NODEJS_22_X,
        });
        appsync.addLambdaDataSource(`${props.name}GetPrintSettingsDS`, getPrintSettings)
            .createResolver(`${props.name}-GetPrintSettingsResolver`, {
            typeName: 'Query',
            fieldName: 'getPrintSettings',
        });
        const updatePrintSettings = new aws_lambda_nodejs_1.NodejsFunction(this, `${props.name}-UpdatePrintSettings`, {
            entry: (0, path_1.join)(__dirname, '../lambdas', 'appsync', 'printSettings', 'updatePrintSettings.ts'),
            timeout: aws_cdk_lib_1.Duration.seconds(30),
            role: printSettingsRole,
            bundling: { externalModules: ['aws-sdk'] },
            depsLockFilePath: (0, path_1.join)(__dirname, '../lambdas', 'package-lock.json'),
            environment: {
                PRINT_SETTINGS_TABLE_NAME: printSettingsDynamoName,
            },
            runtime: aws_lambda_1.Runtime.NODEJS_22_X,
        });
        appsync.addLambdaDataSource(`${props.name}UpdatePrintSettingsDS`, updatePrintSettings)
            .createResolver(`${props.name}-UpdatePrintSettingsResolver`, {
            typeName: 'Mutation',
            fieldName: 'updatePrintSettings',
        });
    }
}
exports.AppsyncStack = AppsyncStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwc3luYy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFwcHN5bmMtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsNkNBQW9GO0FBQ3BGLHFHQUFxRztBQUNyRyx5REFBbUQ7QUFDbkQsOEVBQWdHO0FBQ2hHLGlEQUFvRztBQUNwRyx1REFBZ0Q7QUFDaEQscUVBQW1GO0FBQ25GLDZDQUFpQztBQU1qQyxNQUFhLFlBQWEsU0FBUSxtQkFBSztJQUNyQyxZQUFZLEdBQVEsRUFBRSxFQUFVLEVBQUUsS0FBbUI7UUFDbkQsS0FBSyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQTtRQUVkLE1BQU0sY0FBYyxHQUFHLGdCQUFFLENBQUMsV0FBVyxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksaUJBQWlCLENBQUMsQ0FBQTtRQUNyRSxNQUFNLGFBQWEsR0FBRyxnQkFBRSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLGdCQUFnQixDQUFDLENBQUE7UUFFbkUsTUFBTSxjQUFjLEdBQUcsZ0JBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxLQUFLLENBQUMsSUFBSSxpQkFBaUIsQ0FBQyxDQUFBO1FBQ3JFLE1BQU0sYUFBYSxHQUFHLGdCQUFFLENBQUMsV0FBVyxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksZ0JBQWdCLENBQUMsQ0FBQTtRQUVuRSxNQUFNLGtCQUFrQixHQUFHLGdCQUFFLENBQUMsV0FBVyxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUkscUJBQXFCLENBQUMsQ0FBQTtRQUM3RSxNQUFNLGlCQUFpQixHQUFHLGdCQUFFLENBQUMsV0FBVyxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksb0JBQW9CLENBQUMsQ0FBQTtRQUUzRSxNQUFNLE9BQU8sR0FBRyxJQUFJLHlDQUFpQixDQUFDLElBQUksRUFBRSxHQUFHLEtBQUssQ0FBQyxJQUFJLFVB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QUFDLEdBQUcsS0FBSyxDQUFDLElBQUksdUJBQXVCLEVBQUUsbUJBQW1CLENBQUM7YUFDckYsY0FBYyxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksOEJBQThCLEVBQUU7WUFDM0QsUUFBUSxFQUFFLFVBQVU7WUFDcEIsU0FBUyxFQUFFLHFCQUFxQjtTQUNqQyxDQUFDLENBQUE7SUFDSixDQUFDO0NBQ0Y7QUE5TEQsb0NBOExDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQXBwLCBDZm5EZWxldGlvblBvbGljeSwgQ2ZuT3V0cHV0LCBEdXJhdGlvbiwgRm4sIFN0YWNrIH0gZnJvbSAnYXdzLWNkay1saWInXG4vLyBpbXBvcnQgeyBHcmFwaHFsQXBpLCBTY2hlbWFGaWxlLCBBdXRob3JpemF0aW9uVHlwZSwgRmllbGRMb2dMZXZlbCB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcHBzeW5jJ1xuaW1wb3J0IHsgQ2ZuQXBpS2V5IH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwcHN5bmMnXG5pbXBvcnQgeyBBbXBsaWZ5R3JhcGhxbEFwaSwgQW1wbGlmeUdyYXBocWxEZWZpbml0aW9uIH0gZnJvbSAnQGF3cy1hbXBsaWZ5L2dyYXBocWwtYXBpLWNvbnN0cnVjdCdcbmltcG9ydCB7IE1hbmFnZWRQb2xpY3ksIFBvbGljeSwgUG9saWN5U3RhdGVtZW50LCBSb2xlLCBTZXJ2aWNlUHJpbmNpcGFsIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSdcbmltcG9ydCB7IFJ1bnRpbWUgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJ1xuaW1wb3J0IHsgTm9kZWpzRnVuY3Rpb24sIE5vZGVqc0Z1bmN0aW9uUHJvcHMgfSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhLW5vZGVqcydcbmltcG9ydCBwYXRoLCB7IGpvaW4gfSBmcm9tICdwYXRoJ1xuXG5pbnRlcmZhY2UgQXBwc3luY1Byb3BzIHtcbiAgbmFtZTogc3RyaW5nXG59XG5cbmV4cG9ydCBjbGFzcyBBcHBzeW5jU3RhY2sgZXh0ZW5kcyBTdGFjayB7XG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBpZDogc3RyaW5nLCBwcm9wczogQXBwc3luY1Byb3BzKSB7XG4gICAgc3VwZXIoYXBwLCBpZClcblxuICAgIGNvbnN0IHVzZXJEeW5hbW9OYW1lID0gRm4uaW1wb3J0VmFsdWUoYCR7cHJvcHMubmFtZX0tVXNlclRhYmxlLU5hbWVgKVxuICAgIGNvbnN0IHVzZXJEeW5hbW9Bcm4gPSBGbi5pbXBvcnRWYWx1ZShgJHtwcm9wcy5uYW1lfS1Vc2VyVGFibGUtQXJuYClcblxuICAgIGNvbnN0IGNhcmREeW5hbW9OYW1lID0gRm4uaW1wb3J0VmFsdWUoYCR7cHJvcHMubmFtZX0tQ2FyZFRhYmxlLU5hbWVgKVxuICAgIGNvbnN0IGNhcmREeW5hbW9Bcm4gPSBGbi5pbXBvcnRWYWx1ZShgJHtwcm9wcy5uYW1lfS1DYXJkVGFibGUtQXJuYClcblxuICAgIGNvbnN0IGZpbGFtZW50RHluYW1vTmFtZSA9IEZuLmltcG9ydFZhbHVlKGAke3Byb3BzLm5hbWV9LUZpbGFtZW50VGFibGUtTmFtZWApXG4gICAgY29uc3QgZmlsYW1lbnREeW5hbW9Bcm4gPSBGbi5pbXBvcnRWYWx1ZShgJHtwcm9wcy5uYW1lfS1GaWxhbWVudFRhYmxlLUFybmApXG5cbiAgICBjb25zdCBhcHBzeW5jID0gbmV3IEFtcGxpZnlHcmFwaHFsQXBpKHRoaXMsIGAke3Byb3BzLm5hbWV9LUFwcHN5bmNgLCB7XG4gICAgICBhcGlOYW1lOiBgJHtwcm9wcy5uYW1lfWAsXG4gICAgICBkZWZpbml0aW9uOiBBbXBsaWZ5R3JhcGhxbERlZmluaXRpb24uZnJvbUZpbGVzKHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vXCIsICdzY2hlbWEuZ3JhcGhxbCcpKSxcbiAgICAgIGF1dGhvcml6YXRpb25Nb2Rlczoge1xuICAgICAgICBhcGlLZXlDb25maWc6IHsgZXhwaXJlczogRHVyYXRpb24uZGF5cygzNjUpIH1cbiAgICAgIH1cbiAgICB9KVxuXG4gICAgLy8gVGhlIG9yaWdpbmFsIGRlZmF1bHQga2V5IChsb2dpY2FsIElEIG10Z3N0b3JlQXBwc3luY0dyYXBoUUxBUElEZWZhdWx0QXBpS2V5RjNGRUVERDcpXG4gICAgLy8gZXhwaXJlZCAyMDI2LTA1LTEwLiBBcHBTeW5jIGRlbGV0ZWQgaXQsIGFuZCBDbG91ZEZvcm1hdGlvbiBzdGlsbCB0cmFja3MgdGhhdCBsb2dpY2FsXG4gICAgLy8gSUQsIHNvIGFuIGluLXBsYWNlIEV4cGlyZXMgdXBkYXRlIHJldHVybnMgXCJBUEkga2V5IG5vdCBmb3VuZFwiLiBLZWVwIHRoaXMgcmVzb3VyY2VcbiAgICAvLyBpZGVudGljYWwgdG8gdGhlIGxhc3Qgc3VjY2Vzc2Z1bCB0ZW1wbGF0ZSAoZG8gbm90IGNoYW5nZSBFeHBpcmVzKSBhbmQgcmV0YWluIGl0IHNvXG4gICAgLy8gYSBsYXRlciByZW1vdmFsIGRvZXMgbm90IGNhbGwgRGVsZXRlQXBpS2V5IG9uIGEga2V5IHRoYXQgaXMgYWxyZWFkeSBnb25lLlxuICAgIC8vIEFwcFN5bmMga2V5cyBsYXN0IGF0IG1vc3QgMzY1IGRheXMuIEJlZm9yZSB0aGUgc2hvcCBrZXkgYmVsb3cgZXhwaXJlcywgYWRkIGFub3RoZXJcbiAgICAvLyBDZm5BcGlLZXkgd2l0aCBhIG5ldyBjb25zdHJ1Y3QgaWQsIHBvaW50IHRoZSBvdXRwdXRzIGF0IGl0LCBhbmQgZnJlZXplIHRoZSBwcmV2aW91c1xuICAgIC8vIGtleSB0aGUgc2FtZSB3YXkuXG4gICAgY29uc3QgZXhwaXJlZEtleSA9IGFwcHN5bmMucmVzb3VyY2VzLmNmblJlc291cmNlcy5jZm5BcGlLZXlcbiAgICBpZiAoIWV4cGlyZWRLZXkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQW1wbGlmeUdyYXBocWxBcGkgZGlkIG5vdCBjcmVhdGUgdGhlIGRlZmF1bHQgQVBJIGtleScpXG4gICAgfVxuICAgIGV4cGlyZWRLZXkuZXhwaXJlcyA9IDE3Nzg0MjQ2NDlcbiAgICBleHBpcmVkS2V5LmNmbk9wdGlvbnMuZGVsZXRpb25Qb2xpY3kgPSBDZm5EZWxldGlvblBvbGljeS5SRVRBSU5cbiAgICBleHBpcmVkS2V5LmNmbk9wdGlvbnMudXBkYXRlUmVwbGFjZVBvbGljeSA9IENmbkRlbGV0aW9uUG9saWN5LlJFVEFJTlxuXG4gICAgY29uc3QgYXBpU2NvcGUgPSBleHBpcmVkS2V5Lm5vZGUuc2NvcGVcbiAgICBpZiAoIWFwaVNjb3BlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0RlZmF1bHQgQVBJIGtleSBoYXMgbm8gcGFyZW50IHNjb3BlJylcbiAgICB9XG4gICAgY29uc3QgaG91clNlY29uZHMgPSA2MCAqIDYwXG4gICAgY29uc3Qgc3ludGhIb3VyID0gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCAvIGhvdXJTZWNvbmRzKSAqIGhvdXJTZWNvbmRzXG4gICAgLy8gMzY1IGRheXMgaXMgdGhlIEFwcFN5bmMgbWF4aW11bSwgbWVhc3VyZWQgZnJvbSBkZXBsb3kgdGltZS4gU3RhbXAgZXhwaXJ5IG9uZSBob3VyXG4gICAgLy8gdW5kZXIgMzY1IGRheXMgZnJvbSB0aGUgc3ludGggaG91ciBzbyBhIGRlcGxveSBzaG9ydGx5IGFmdGVyIHN5bnRoIGlzIGFjY2VwdGVkLlxuICAgIGNvbnN0IHNob3BLZXkgPSBuZXcgQ2ZuQXBpS2V5KGFwaVNjb3BlLCAnU2hvcEFwaUtleTIwMjYxMTEyJywge1xuICAgICAgYXBpSWQ6IGFwcHN5bmMuYXBpSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ1N0b3JlZnJvbnQgQVBJIGtleS4gUm90YXRlIGJlZm9yZSBpdCBleHBpcmVzICgzNjUgZGF5IEFwcFN5bmMgbWF4aW11bSkuJyxcbiAgICAgIGV4cGlyZXM6IHN5bnRoSG91ciArICgzNjUgKiAyNCAqIGhvdXJTZWNvbmRzKSAtIGhvdXJTZWNvbmRzLFxuICAgIH0pXG5cbiAgICBjb25zdCBhbXBsaWZ5S2V5T3V0cHV0ID0gdGhpcy5ub2RlLnRyeUZpbmRDaGlsZCgnYXdzQXBwc3luY0FwaUtleScpIGFzIENmbk91dHB1dCB8IHVuZGVmaW5lZFxuICAgIGlmICghYW1wbGlmeUtleU91dHB1dCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3RlZCBzdGFjayBvdXRwdXQgYXdzQXBwc3luY0FwaUtleScpXG4gICAgfVxuICAgIGFtcGxpZnlLZXlPdXRwdXQudmFsdWUgPSBzaG9wS2V5LmF0dHJBcGlLZXlcblxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgXCJHcmFwaFFMQVBJVVJMXCIsIHsgdmFsdWU6IGFwcHN5bmMuZ3JhcGhxbFVybCB9KVxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgXCJHcmFwaFFMQVBJS2V5XCIsIHsgdmFsdWU6IHNob3BLZXkuYXR0ckFwaUtleSB9KVxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgXCJTdGFjayBSZWdpb25cIiwgeyB2YWx1ZTogdGhpcy5yZWdpb24gfSlcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsIGAke3Byb3BzLm5hbWV9LUFwcHN5bmNJZGAsIHsgdmFsdWU6IGFwcHN5bmMuYXBpSWQgfSlcblxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgYCR7cHJvcHMubmFtZX0tQXBwc3luY0FybmAsIHtcbiAgICAgIHZhbHVlOiBhcHBzeW5jLnJlc291cmNlcy5ncmFwaHFsQXBpLmFybixcbiAgICAgIGV4cG9ydE5hbWU6IGAke3Byb3BzLm5hbWV9LUFwcHN5bmNBcm5gXG4gICAgfSlcblxuICAgIGNvbnN0IGV4Y1JvbGUgPSBuZXcgUm9sZSh0aGlzLCBgJHtwcm9wcy5uYW1lfS1BcHBzeW5jTGFtYmRhUm9sZWAsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IFNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJylcbiAgICB9KVxuXG4gICAgZXhjUm9sZS5hZGRNYW5hZ2VkUG9saWN5KFxuICAgICAgTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoXCJzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlXCIpXG4gICAgKVxuXG4gICAgZXhjUm9sZS5hdHRhY2hJbmxpbmVQb2xpY3koXG4gICAgICBuZXcgUG9saWN5KHRoaXMsIGAke3Byb3BzLm5hbWV9LUlubGluZVBvbGljeWAsIHtcbiAgICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICAgIG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICBcInNlY3JldHNtYW5hZ2VyOkdldFJlc291cmNlUG9saWN5XCIsXG4gICAgICAgICAgICAgIFwic2VjcmV0c21hbmFnZXI6R2V0U2VjcmV0VmFsdWVcIixcbiAgICAgICAgICAgICAgXCJzZWNyZXRzbWFuYWdlcjpEZXNjcmliZVNlY3JldFwiLFxuICAgICAgICAgICAgICBcInNlY3JldHNtYW5hZ2VyOkxpc3RTZWNyZXRWZXJzaW9uSWRzXCIsXG4gICAgICAgICAgICAgIFwic2VjcmV0c21hbmFnZXI6TGlzdFNlY3JldHNcIlxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIHJlc291cmNlczogW1wiKlwiXVxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgYWN0aW9uczogWyBcImR5bmFtb2RiOipcIiBdLFxuICAgICAgICAgICAgcmVzb3VyY2VzOiBbIFxuICAgICAgICAgICAgICBgJHt1c2VyRHluYW1vQXJufSpgLCBgJHtjYXJkRHluYW1vQXJufSpgLCBgJHtmaWxhbWVudER5bmFtb0Fybn0qYFxuICAgICAgICAgICAgXVxuICAgICAgICAgIH0pLFxuICAgICAgICAgIG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgYWN0aW9uczogWyBcImxhbWJkYTpJbnZva2VGdW5jdGlvblwiIF0sXG4gICAgICAgICAgICByZXNvdXJjZXM6IFsgYCpgIF1cbiAgICAgICAgICB9KVxuICAgICAgICBdXG4gICAgICB9KVxuICAgIClcblxuICAgIGNvbnN0IG5vZGVKc0Z1bmN0aW9uUHJvcHM6IE5vZGVqc0Z1bmN0aW9uUHJvcHMgPSB7XG4gICAgICByb2xlOiBleGNSb2xlLFxuICAgICAgLy8gTm9kZS5qcyAyMiBkb2VzIG5vdCBpbmNsdWRlIGF3cy1zZGsgdjIuIEJ1bmRsZSBAYXdzLXNkay8qIGludG8gdGhlIGFzc2V0LlxuICAgICAgYnVuZGxpbmc6IHsgYnVuZGxlQXdzU0RLOiB0cnVlIH0sXG4gICAgICBkZXBzTG9ja0ZpbGVQYXRoOiBqb2luKF9fZGlybmFtZSwgJy4uL2xhbWJkYXMnLCAncGFja2FnZS1sb2NrLmpzb24nKSxcbiAgICAgIGVudmlyb25tZW50OiB7IFxuICAgICAgICBVU0VSX1RBQkxFX05BTUU6IHVzZXJEeW5hbW9OYW1lLFxuICAgICAgICBDQVJEX1RBQkxFX05BTUU6IGNhcmREeW5hbW9OYW1lLFxuICAgICAgICBGSUxBTUVOVF9UQUJMRV9OQU1FOiBmaWxhbWVudER5bmFtb05hbWUsXG4gICAgICB9LFxuICAgICAgcnVudGltZTogUnVudGltZS5OT0RFSlNfMjJfWCxcbiAgICB9XG5cbiAgICBjb25zdCBzZWFyY2hDYXJkQnlOYW1lID0gbmV3IE5vZGVqc0Z1bmN0aW9uKHRoaXMsIGAke3Byb3BzLm5hbWV9LVNlYXJjaENhcmRCeU5hbWVgLCB7XG4gICAgICBlbnRyeTogam9pbihfX2Rpcm5hbWUsICcuLi9sYW1iZGFzJywgJ2FwcHN5bmMnLCAnY2FyZCcsICdzZWFyY2hDYXJkQnlOYW1lLnRzJyksXG4gICAgICB0aW1lb3V0OiBEdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgLi4ubm9kZUpzRnVuY3Rpb25Qcm9wc1xuICAgIH0pXG5cbiAgICBhcHBzeW5jLmFkZExhbWJkYURhdGFTb3VyY2UoYCR7cHJvcHMubmFtZX1TZWFyY2hDYXJkQnlOYW1lRFNgLCBzZWFyY2hDYXJkQnlOYW1lKVxuICAgIC5jcmVhdGVSZXNvbHZlcihgJHtwcm9wcy5uYW1lfS1TZWFyY2hDYXJkQnlOYW1lUmVzb2x2ZXJgLCB7XG4gICAgICB0eXBlTmFtZTogXCJRdWVyeVwiLFxuICAgICAgZmllbGROYW1lOiBcInNlYXJjaENhcmRCeU5hbWVcIlxuICAgIH0pXG5cbiAgICBjb25zdCBsaXN0RmlsYW1lbnRzID0gbmV3IE5vZGVqc0Z1bmN0aW9uKHRoaXMsIGAke3Byb3BzLm5hbWV9LUxpc3RGaWxhbWVudHNgLCB7XG4gICAgICBlbnRyeTogam9pbihfX2Rpcm5hbWUsICcuLi9sYW1iZGFzJywgJ2FwcHN5bmMnLCAnZmlsYW1lbnQnLCAnbGlzdEZpbGFtZW50cy50cycpLFxuICAgICAgdGltZW91dDogRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICAuLi5ub2RlSnNGdW5jdGlvblByb3BzLFxuICAgIH0pXG5cbiAgICBhcHBzeW5jLmFkZExhbWJkYURhdGFTb3VyY2UoYCR7cHJvcHMubmFtZX1MaXN0RmlsYW1lbnRzRFNgLCBsaXN0RmlsYW1lbnRzKVxuICAgIC5jcmVhdGVSZXNvbHZlcihgJHtwcm9wcy5uYW1lfS1MaXN0RmlsYW1lbnRzUmVzb2x2ZXJgLCB7XG4gICAgICB0eXBlTmFtZTogXCJRdWVyeVwiLFxuICAgICAgZmllbGROYW1lOiBcImxpc3RGaWxhbWVudHNcIlxuICAgIH0pXG5cbiAgICAvLyBOZXcgdGFibGUgb25seS4gVGhlIGV4aXN0aW5nIGxhbWJkYSByb2xlIGlzIGxlZnQgdW5jaGFuZ2VkLlxuICAgIGNvbnN0IHByaW50U2V0dGluZ3NEeW5hbW9OYW1lID0gRm4uaW1wb3J0VmFsdWUoYCR7cHJvcHMubmFtZX0tUHJpbnRTZXR0aW5nc1RhYmxlLU5hbWVgKVxuICAgIGNvbnN0IHByaW50U2V0dGluZ3NEeW5hbW9Bcm4gPSBGbi5pbXBvcnRWYWx1ZShgJHtwcm9wcy5uYW1lfS1QcmludFNldHRpbmdzVGFibGUtQXJuYClcblxuICAgIGNvbnN0IHByaW50U2V0dGluZ3NSb2xlID0gbmV3IFJvbGUodGhpcywgYCR7cHJvcHMubmFtZX0tUHJpbnRTZXR0aW5nc0xhbWJkYVJvbGVgLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBTZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgIH0pXG4gICAgcHJpbnRTZXR0aW5nc1JvbGUuYWRkTWFuYWdlZFBvbGljeShcbiAgICAgIE1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlJyksXG4gICAgKVxuICAgIHByaW50U2V0dGluZ3NSb2xlLmFkZFRvUG9saWN5KG5ldyBQb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWydkeW5hbW9kYjpHZXRJdGVtJywgJ2R5bmFtb2RiOlB1dEl0ZW0nXSxcbiAgICAgIHJlc291cmNlczogW3ByaW50U2V0dGluZ3NEeW5hbW9Bcm5dLFxuICAgIH0pKVxuXG4gICAgY29uc3QgZ2V0UHJpbnRTZXR0aW5ncyA9IG5ldyBOb2RlanNGdW5jdGlvbih0aGlzLCBgJHtwcm9wcy5uYW1lfS1HZXRQcmludFNldHRpbmdzYCwge1xuICAgICAgZW50cnk6IGpvaW4oX19kaXJuYW1lLCAnLi4vbGFtYmRhcycsICdhcHBzeW5jJywgJ3ByaW50U2V0dGluZ3MnLCAnZ2V0UHJpbnRTZXR0aW5ncy50cycpLFxuICAgICAgdGltZW91dDogRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICByb2xlOiBwcmludFNldHRpbmdzUm9sZSxcbiAgICAgIGJ1bmRsaW5nOiB7IGV4dGVybmFsTW9kdWxlczogWydhd3Mtc2RrJ10gfSxcbiAgICAgIGRlcHNMb2NrRmlsZVBhdGg6IGpvaW4oX19kaXJuYW1lLCAnLi4vbGFtYmRhcycsICdwYWNrYWdlLWxvY2suanNvbicpLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgUFJJTlRfU0VUVElOR1NfVEFCTEVfTkFNRTogcHJpbnRTZXR0aW5nc0R5bmFtb05hbWUsXG4gICAgICB9LFxuICAgICAgcnVudGltZTogUnVudGltZS5OT0RFSlNfMjJfWCxcbiAgICB9KVxuXG4gICAgYXBwc3luYy5hZGRMYW1iZGFEYXRhU291cmNlKGAke3Byb3BzLm5hbWV9R2V0UHJpbnRTZXR0aW5nc0RTYCwgZ2V0UHJpbnRTZXR0aW5ncylcbiAgICAuY3JlYXRlUmVzb2x2ZXIoYCR7cHJvcHMubmFtZX0tR2V0UHJpbnRTZXR0aW5nc1Jlc29sdmVyYCwge1xuICAgICAgdHlwZU5hbWU6ICdRdWVyeScsXG4gICAgICBmaWVsZE5hbWU6ICdnZXRQcmludFNldHRpbmdzJyxcbiAgICB9KVxuXG4gICAgY29uc3QgdXBkYXRlUHJpbnRTZXR0aW5ncyA9IG5ldyBOb2RlanNGdW5jdGlvbih0aGlzLCBgJHtwcm9wcy5uYW1lfS1VcGRhdGVQcmludFNldHRpbmdzYCwge1xuICAgICAgZW50cnk6IGpvaW4oX19kaXJuYW1lLCAnLi4vbGFtYmRhcycsICdhcHBzeW5jJywgJ3ByaW50U2V0dGluZ3MnLCAndXBkYXRlUHJpbnRTZXR0aW5ncy50cycpLFxuICAgICAgdGltZW91dDogRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICByb2xlOiBwcmludFNldHRpbmdzUm9sZSxcbiAgICAgIGJ1bmRsaW5nOiB7IGV4dGVybmFsTW9kdWxlczogWydhd3Mtc2RrJ10gfSxcbiAgICAgIGRlcHNMb2NrRmlsZVBhdGg6IGpvaW4oX19kaXJuYW1lLCAnLi4vbGFtYmRhcycsICdwYWNrYWdlLWxvY2suanNvbicpLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgUFJJTlRfU0VUVElOR1NfVEFCTEVfTkFNRTogcHJpbnRTZXR0aW5nc0R5bmFtb05hbWUsXG4gICAgICB9LFxuICAgICAgcnVudGltZTogUnVudGltZS5OT0RFSlNfMjJfWCxcbiAgICB9KVxuXG4gICAgYXBwc3luYy5hZGRMYW1iZGFEYXRhU291cmNlKGAke3Byb3BzLm5hbWV9VXBkYXRlUHJpbnRTZXR0aW5nc0RTYCwgdXBkYXRlUHJpbnRTZXR0aW5ncylcbiAgICAuY3JlYXRlUmVzb2x2ZXIoYCR7cHJvcHMubmFtZX0tVXBkYXRlUHJpbnRTZXR0aW5nc1Jlc29sdmVyYCwge1xuICAgICAgdHlwZU5hbWU6ICdNdXRhdGlvbicsXG4gICAgICBmaWVsZE5hbWU6ICd1cGRhdGVQcmludFNldHRpbmdzJyxcbiAgICB9KVxuICB9XG59Il19