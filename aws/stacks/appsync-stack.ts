import { App, CfnDeletionPolicy, CfnOutput, Duration, Fn, Stack } from 'aws-cdk-lib'
// import { GraphqlApi, SchemaFile, AuthorizationType, FieldLogLevel } from 'aws-cdk-lib/aws-appsync'
import { CfnApiKey } from 'aws-cdk-lib/aws-appsync'
import { AmplifyGraphqlApi, AmplifyGraphqlDefinition } from '@aws-amplify/graphql-api-construct'
import { ManagedPolicy, Policy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import { UserPool } from 'aws-cdk-lib/aws-cognito'
import { Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs'
import path, { join } from 'path'

interface AppsyncProps {
  name: string
  notifyEmail: string
  customerStatusEmails: boolean
  /** Bedrock model or inference-profile id. us.* profiles need the profile ARN. */
  bedrockImageModel: string
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

    const adminPool = UserPool.fromUserPoolId(this, 'AdminPool', Fn.importValue(`${props.name}-UserPoolId`))

    const appsync = new AmplifyGraphqlApi(this, `${props.name}-Appsync`, {
      apiName: `${props.name}`,
      definition: AmplifyGraphqlDefinition.fromFiles(path.join(__dirname, "../", 'schema.graphql')),
      authorizationModes: {
        defaultAuthorizationMode: 'API_KEY',
        apiKeyConfig: { expires: Duration.days(365) },
        userPoolConfig: { userPool: adminPool },
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
    // Fixed epoch so CloudFormation does not replace the key on every deploy.
    // 1826204400 is within AppSync's 365-day maximum from the key's creation.
    const shopKey = new CfnApiKey(apiScope, 'ShopApiKey20261112', {
      apiId: appsync.apiId,
      description: 'Storefront API key. Rotate before it expires (365 day AppSync maximum).',
      expires: 1826204400,
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

    const ordersTableName = Fn.importValue(`${props.name}-OrdersTable-Name`)
    const ordersTableArn = Fn.importValue(`${props.name}-OrdersTable-Arn`)
    const nozzleTableName = Fn.importValue(`${props.name}-NozzleProfilesTable-Name`)
    const nozzleTableArn = Fn.importValue(`${props.name}-NozzleProfilesTable-Arn`)
    const orderBucketName = Fn.importValue(`${props.name}-OrderBucketName`)
    const orderBucketArn = Fn.importValue(`${props.name}-OrderBucketArn`)
    const orderQueueUrl = Fn.importValue(`${props.name}-OrderQueueUrl`)
    const orderQueueArn = Fn.importValue(`${props.name}-OrderQueueArn`)
    const notifyTopicArn = Fn.importValue(`${props.name}-NotifyTopicArn`)

    const orderRole = new Role(this, `${props.name}-OrderLambdaRole`, {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    })
    orderRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'))
    orderRole.addToPolicy(new PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Query', 'dynamodb:Scan'],
      resources: [
        ordersTableArn, `${ordersTableArn}/index/*`,
        nozzleTableArn,
        filamentDynamoArn,
        printSettingsDynamoArn,
      ],
    }))
    orderRole.addToPolicy(new PolicyStatement({
      actions: ['s3:GetObject', 's3:PutObject'],
      resources: [`${orderBucketArn}/*`],
    }))
    orderRole.addToPolicy(new PolicyStatement({
      actions: ['s3:ListBucket'],
      resources: [orderBucketArn],
    }))
    orderRole.addToPolicy(new PolicyStatement({
      actions: ['sqs:SendMessage'],
      resources: [orderQueueArn],
    }))
    orderRole.addToPolicy(new PolicyStatement({
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }))
    orderRole.addToPolicy(new PolicyStatement({
      actions: ['sns:Publish'],
      resources: [notifyTopicArn],
    }))

    const orderEnvironment = {
      ORDERS_TABLE_NAME: ordersTableName,
      NOZZLE_PROFILES_TABLE_NAME: nozzleTableName,
      FILAMENT_TABLE_NAME: filamentDynamoName,
      PRINT_SETTINGS_TABLE_NAME: printSettingsDynamoName,
      ORDER_BUCKET_NAME: orderBucketName,
      ORDER_QUEUE_URL: orderQueueUrl,
      NOTIFY_EMAIL: props.notifyEmail,
      NOTIFY_TOPIC_ARN: notifyTopicArn,
      CUSTOMER_STATUS_EMAILS: props.customerStatusEmails ? 'true' : 'false',
      PRESIGN_TTL_SECONDS: String(4 * 60 * 60),
    }
    const orderFunction = (id: string, entry: string, fieldName: string, typeName: 'Query' | 'Mutation') => {
      const fn = new NodejsFunction(this, `${props.name}-${id}`, {
        entry: join(__dirname, '../lambdas', entry),
        timeout: Duration.seconds(30),
        role: orderRole,
        bundling: { bundleAwsSDK: true },
        depsLockFilePath: join(__dirname, '../lambdas', 'package-lock.json'),
        environment: orderEnvironment,
        runtime: Runtime.NODEJS_22_X,
      })
      appsync.addLambdaDataSource(`${props.name}${id}DS`, fn)
        .createResolver(`${props.name}-${id}Resolver`, { typeName, fieldName })
    }

    orderFunction('SubmitOrder', 'appsync/orders/submitOrder.ts', 'submitOrder', 'Mutation')
    orderFunction('ConfirmOrder', 'appsync/orders/confirmOrder.ts', 'confirmOrder', 'Mutation')
    orderFunction('TrackOrder', 'appsync/orders/trackOrder.ts', 'trackOrder', 'Query')
    orderFunction('ListOrders', 'appsync/orders/adminOrders.ts', 'listOrders', 'Query')
    orderFunction('GetAdminOrder', 'appsync/orders/adminOrders.ts', 'getAdminOrder', 'Query')
    orderFunction('UpdateOrderStatus', 'appsync/orders/adminOrders.ts', 'updateOrderStatus', 'Mutation')
    orderFunction('RetryOrder', 'appsync/orders/adminOrders.ts', 'retryOrderGeneration', 'Mutation')
    orderFunction('RefreshDownloads', 'appsync/orders/adminOrders.ts', 'refreshDownloadLinks', 'Mutation')
    orderFunction('AdvanceOrder', 'appsync/orders/adminOrders.ts', 'advanceOrder', 'Mutation')
    orderFunction('UndoOrder', 'appsync/orders/adminOrders.ts', 'undoOrder', 'Mutation')
    orderFunction('RequestDeliveryPhoto', 'appsync/orders/adminOrders.ts', 'requestDeliveryPhotoUpload', 'Mutation')
    orderFunction('ConfirmDelivery', 'appsync/orders/adminOrders.ts', 'confirmDelivery', 'Mutation')
    orderFunction('ListActiveProfiles', 'appsync/nozzleProfiles/profiles.ts', 'listActiveNozzleProfiles', 'Query')
    orderFunction('ListProfiles', 'appsync/nozzleProfiles/profiles.ts', 'listNozzleProfiles', 'Query')
    orderFunction('UpsertProfile', 'appsync/nozzleProfiles/profiles.ts', 'upsertNozzleProfile', 'Mutation')
    orderFunction('DeactivateProfile', 'appsync/nozzleProfiles/profiles.ts', 'deactivateNozzleProfile', 'Mutation')

    const outpaint = new NodejsFunction(this, `${props.name}-OutpaintArt`, {
      entry: join(__dirname, '../lambdas', 'outpaint', 'handler.ts'),
      timeout: Duration.seconds(60),
      memorySize: 1024,
      role: orderRole,
      bundling: { bundleAwsSDK: true },
      depsLockFilePath: join(__dirname, '../lambdas', 'package-lock.json'),
      environment: {
        ...orderEnvironment,
        BEDROCK_IMAGE_MODEL: props.bedrockImageModel,
      },
      runtime: Runtime.NODEJS_22_X,
    })
    outpaint.addToRolePolicy(new PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: bedrockInvokeResources(this.region, this.account, props.bedrockImageModel),
    }))
    appsync.addLambdaDataSource(`${props.name}OutpaintDS`, outpaint)
      .createResolver(`${props.name}-OutpaintResolver`, { typeName: 'Query', fieldName: 'outpaintCommanderArt' })
  }
}

/**
 * InvokeModel on a geo profile also needs the foundation model in each
 * destination region. us.stability.stable-outpaint-v1:0 routes across
 * us-east-1, us-east-2, and us-west-2.
 */
function bedrockInvokeResources(region: string, account: string, modelId: string): string[] {
  const geo = /^(us|eu|apac|global)\./.exec(modelId)
  if (!geo) {
    return [`arn:aws:bedrock:${region}::foundation-model/${modelId}`]
  }
  const foundationId = modelId.slice(geo[0].length)
  const destinations = geo[1] === 'us'
    ? ['us-east-1', 'us-east-2', 'us-west-2']
    : geo[1] === 'eu'
      ? ['eu-central-1', 'eu-west-1', 'eu-west-3']
      : [region]
  return [
    `arn:aws:bedrock:${region}:${account}:inference-profile/${modelId}`,
    ...destinations.map((destination) => `arn:aws:bedrock:${destination}::foundation-model/${foundationId}`),
  ]
}