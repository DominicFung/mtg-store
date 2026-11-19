import { App, CfnOutput, Duration, Fn, Stack } from 'aws-cdk-lib'
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'
import { CfnPermission, FunctionUrlAuthType, HttpMethod, Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Secret } from 'aws-cdk-lib/aws-secretsmanager'
import { join } from 'path'

interface PaymentsProps {
  name: string
}

/**
 * Card payment for a deck box. Public function URLs, plus read access to the
 * two Stripe secrets. It does not change the GraphQL API, the shop key, or
 * any existing table, queue, or bucket.
 *
 * The secrets mtgstore/stripe/secret-key and mtgstore/stripe/webhook-secret
 * already exist. This stack only looks them up by name. CloudFormation does
 * not create them and does not write their values. The first deploy created
 * them with DeletionPolicy Retain, so taking them out of the template leaves
 * the secrets, and the current secret-key value, in place.
 */
export class PaymentsStack extends Stack {
  constructor(app: App, id: string, props: PaymentsProps) {
    super(app, id)

    const ordersTableArn = Fn.importValue(`${props.name}-OrdersTable-Arn`)
    const ordersTableName = Fn.importValue(`${props.name}-OrdersTable-Name`)
    const secretKey = Secret.fromSecretNameV2(this, 'StripeSecretKey', `${props.name}/stripe/secret-key`)
    const webhookSecret = Secret.fromSecretNameV2(this, 'StripeWebhookSecret', `${props.name}/stripe/webhook-secret`)

    const shared = {
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(20),
      memorySize: 256,
      depsLockFilePath: join(__dirname, '../lambdas', 'package-lock.json'),
      bundling: { bundleAwsSDK: true },
      environment: {
        ORDERS_TABLE_NAME: ordersTableName,
        STRIPE_SECRET_ID: secretKey.secretName,
        STRIPE_WEBHOOK_SECRET_ID: webhookSecret.secretName,
      },
    }

    const checkout = new NodejsFunction(this, `${props.name}-CreateCheckout`, {
      entry: join(__dirname, '../lambdas', 'payments', 'createCheckout.ts'),
      ...shared,
    })
    const webhook = new NodejsFunction(this, `${props.name}-StripeWebhook`, {
      entry: join(__dirname, '../lambdas', 'payments', 'webhook.ts'),
      ...shared,
    })

    const tableResources = [ordersTableArn, `${ordersTableArn}/index/*`]
    for (const fn of [checkout, webhook]) {
      fn.addToRolePolicy(new PolicyStatement({
        actions: ['dynamodb:GetItem', 'dynamodb:Query', 'dynamodb:UpdateItem'],
        resources: tableResources,
      }))
    }
    secretKey.grantRead(checkout)
    webhookSecret.grantRead(webhook)

    const checkoutUrl = checkout.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['*'],
        allowedMethods: [HttpMethod.POST],
        allowedHeaders: ['content-type'],
      },
    })
    const webhookUrl = webhook.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
    })
    allowPublicInvoke(checkout, 'CreateCheckoutPublicInvoke')
    allowPublicInvoke(webhook, 'StripeWebhookPublicInvoke')

    new CfnOutput(this, `${props.name}-CheckoutUrl`, {
      value: checkoutUrl.url,
      description: 'Set NEXT_PUBLIC_PAYMENTS_URL to this value, then rebuild the web app.',
    })
    new CfnOutput(this, `${props.name}-StripeWebhookUrl`, {
      value: webhookUrl.url,
      description: 'Stripe webhook endpoint. Subscribe to checkout.session.completed.',
    })
  }
}

/**
 * Public function URLs need both lambda:InvokeFunctionUrl and
 * lambda:InvokeFunction. CDK already adds the first. This adds the second,
 * limited to calls that arrive through the function URL.
 *
 * InvokedViaFunctionUrl is a CloudFormation property. This CDK release does
 * not type it, so it is set with a property override.
 */
function allowPublicInvoke(fn: NodejsFunction, id: string) {
  const permission = new CfnPermission(fn, id, {
    action: 'lambda:InvokeFunction',
    functionName: fn.functionArn,
    principal: '*',
  })
  permission.addPropertyOverride('InvokedViaFunctionUrl', true)
}
