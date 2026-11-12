import { App, CfnDeletionPolicy, CfnOutput, Duration, Fn, Stack } from 'aws-cdk-lib'
// import { GraphqlApi, SchemaFile, AuthorizationType, FieldLogLevel } from 'aws-cdk-lib/aws-appsync'
import { CfnApiKey } from 'aws-cdk-lib/aws-appsync'
import { AmplifyGraphqlApi, AmplifyGraphqlDefinition } from '@aws-amplify/graphql-api-construct'
import { ManagedPolicy, Policy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs'
import path, { join } from 'path'

interface AppsyncProps {
  name: string
}

export class AppsyncStack extends Stack {
  constructor(app: App, id: string, props: AppsyncProps) {
    super(app, id)

    const userDynamoName = Fn.importValue(`${props.name}-UserTable-Name`)
    const userDynamoArn = Fn.importValue(`${props.name}-UserTable-Arn`)

    const cardDynamoName = Fn.importValue(`${props.name}-CardTable-Name`)
    const cardDynamoArn = Fn.importValue(`${props.name}-CardTable-Arn`)

    const filamentDynamoName = Fn.importValue(`${props.name}-FilamentTable-Name`)
    const filamentDynamoArn = Fn.importValue(`${props.name}-FilamentTable-Arn`)

    const appsync = new AmplifyGraphqlApi(this, `${props.name}-Appsync`, {
      apiName: `${props.name}`,
      definition: AmplifyGraphqlDefinition.fromFiles(path.join(__dirname, "../", 'schema.graphql')),
      authorizationModes: {
        apiKeyConfig: { expires: Duration.days(365) }
      }
    })

    // The original default key (logical ID mtgstoreAppsyncGraphQLAPIDefaultApiKeyF3FEEDD7)
    // expired 2026-05-10. AppSync deleted it, and CloudFormation still tracks that logical
    // ID, so an in-place Expires update returns "API key not found". Keep this resource
    // identical to the last successful template (do not change Expires) and retain it so
    // a later removal does not call DeleteApiKey on a key that is already gone.
    // AppSync keys last at most 365 days. Before the shop key below expires, add another
    // CfnApiKey with a new construct id, point the outputs at it, and freeze the previous
    // key the same way.
    const expiredKey = appsync.resources.cfnResources.cfnApiKey
    if (!expiredKey) {
      throw new Error('AmplifyGraphqlApi did not create the default API key')
    }
    expiredKey.expires = 1778424649
    expiredKey.cfnOptions.deletionPolicy = CfnDeletionPolicy.RETAIN
    expiredKey.cfnOptions.updateReplacePolicy = CfnDeletionPolicy.RETAIN

    const apiScope = expiredKey.node.scope
    if (!apiScope) {
      throw new Error('Default API key has no parent scope')
    }
    const hourSeconds = 60 * 60
    const synthHour = Math.floor(Date.now() / 1000 / hourSeconds) * hourSeconds
    // 365 days is the AppSync maximum, measured from deploy time. Stamp expiry one hour
    // under 365 days from the synth hour so a deploy shortly after synth is accepted.
    const shopKey = new CfnApiKey(apiScope, 'ShopApiKey20261112', {
      apiId: appsync.apiId,
      description: 'Storefront API key. Rotate before it expires (365 day AppSync maximum).',
      expires: synthHour + (365 * 24 * hourSeconds) - hourSeconds,
    })

    const amplifyKeyOutput = this.node.tryFindChild('awsAppsyncApiKey') as CfnOutput | undefined
    if (!amplifyKeyOutput) {
      throw new Error('Expected stack output awsAppsyncApiKey')
    }
    amplifyKeyOutput.value = shopKey.attrApiKey

    new CfnOutput(this, "GraphQLAPIURL", { value: appsync.graphqlUrl })
    new CfnOutput(this, "GraphQLAPIKey", { value: shopKey.attrApiKey })
    new CfnOutput(this, "Stack Region", { value: this.region })
    new CfnOutput(this, `${props.name}-AppsyncId`, { value: appsync.apiId })

    new CfnOutput(this, `${props.name}-AppsyncArn`, {
      value: appsync.resources.graphqlApi.arn,
      exportName: `${props.name}-AppsyncArn`
    })

    const excRole = new Role(this, `${props.name}-AppsyncLambdaRole`, {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com')
    })

    excRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
    )

    excRole.attachInlinePolicy(
      new Policy(this, `${props.name}-InlinePolicy`, {
        statements: [
          new PolicyStatement({
            actions: [
              "secretsmanager:GetResourcePolicy",
              "secretsmanager:GetSecretValue",
              "secretsmanager:DescribeSecret",
              "secretsmanager:ListSecretVersionIds",
              "secretsmanager:ListSecrets"
            ],
            resources: ["*"]
          }),
          new PolicyStatement({
            actions: [ "dynamodb:*" ],
            resources: [ 
              `${userDynamoArn}*`, `${cardDynamoArn}*`, `${filamentDynamoArn}*`
            ]
          }),
          new PolicyStatement({
            actions: [ "lambda:InvokeFunction" ],
            resources: [ `*` ]
          })
        ]
      })
    )

    const nodeJsFunctionProps: NodejsFunctionProps = {
      role: excRole,
      // Node.js 22 does not include aws-sdk v2. Bundle @aws-sdk/* into the asset.
      bundling: { bundleAwsSDK: true },
      depsLockFilePath: join(__dirname, '../lambdas', 'package-lock.json'),
      environment: { 
        USER_TABLE_NAME: userDynamoName,
        CARD_TABLE_NAME: cardDynamoName,
        FILAMENT_TABLE_NAME: filamentDynamoName,
      },
      runtime: Runtime.NODEJS_22_X,
    }

    const searchCardByName = new NodejsFunction(this, `${props.name}-SearchCardByName`, {
      entry: join(__dirname, '../lambdas', 'appsync', 'card', 'searchCardByName.ts'),
      timeout: Duration.minutes(5),
      ...nodeJsFunctionProps
    })

    appsync.addLambdaDataSource(`${props.name}SearchCardByNameDS`, searchCardByName)
    .createResolver(`${props.name}-SearchCardByNameResolver`, {
      typeName: "Query",
      fieldName: "searchCardByName"
    })

    const listFilaments = new NodejsFunction(this, `${props.name}-ListFilaments`, {
      entry: join(__dirname, '../lambdas', 'appsync', 'filament', 'listFilaments.ts'),
      timeout: Duration.seconds(30),
      ...nodeJsFunctionProps,
    })

    appsync.addLambdaDataSource(`${props.name}ListFilamentsDS`, listFilaments)
    .createResolver(`${props.name}-ListFilamentsResolver`, {
      typeName: "Query",
      fieldName: "listFilaments"
    })

    // New table only. The existing lambda role is left unchanged.
    const printSettingsDynamoName = Fn.importValue(`${props.name}-PrintSettingsTable-Name`)
    const printSettingsDynamoArn = Fn.importValue(`${props.name}-PrintSettingsTable-Arn`)

    const printSettingsRole = new Role(this, `${props.name}-PrintSettingsLambdaRole`, {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    })
    printSettingsRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
    )
    printSettingsRole.addToPolicy(new PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:PutItem'],
      resources: [printSettingsDynamoArn],
    }))

    const getPrintSettings = new NodejsFunction(this, `${props.name}-GetPrintSettings`, {
      entry: join(__dirname, '../lambdas', 'appsync', 'printSettings', 'getPrintSettings.ts'),
      timeout: Duration.seconds(30),
      role: printSettingsRole,
      bundling: { externalModules: ['aws-sdk'] },
      depsLockFilePath: join(__dirname, '../lambdas', 'package-lock.json'),
      environment: {
        PRINT_SETTINGS_TABLE_NAME: printSettingsDynamoName,
      },
      runtime: Runtime.NODEJS_22_X,
    })

    appsync.addLambdaDataSource(`${props.name}GetPrintSettingsDS`, getPrintSettings)
    .createResolver(`${props.name}-GetPrintSettingsResolver`, {
      typeName: 'Query',
      fieldName: 'getPrintSettings',
    })

    const updatePrintSettings = new NodejsFunction(this, `${props.name}-UpdatePrintSettings`, {
      entry: join(__dirname, '../lambdas', 'appsync', 'printSettings', 'updatePrintSettings.ts'),
      timeout: Duration.seconds(30),
      role: printSettingsRole,
      bundling: { externalModules: ['aws-sdk'] },
      depsLockFilePath: join(__dirname, '../lambdas', 'package-lock.json'),
      environment: {
        PRINT_SETTINGS_TABLE_NAME: printSettingsDynamoName,
      },
      runtime: Runtime.NODEJS_22_X,
    })

    appsync.addLambdaDataSource(`${props.name}UpdatePrintSettingsDS`, updatePrintSettings)
    .createResolver(`${props.name}-UpdatePrintSettingsResolver`, {
      typeName: 'Mutation',
      fieldName: 'updatePrintSettings',
    })
  }
}