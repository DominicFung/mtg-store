import { App, CfnOutput, Duration, Fn, RemovalPolicy, SecretValue, Stack } from 'aws-cdk-lib'
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'
import { FunctionUrlAuthType, HttpMethod, Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Secret } from 'aws-cdk-lib/aws-secretsmanager'
import { join } from 'path'

interface PaymentsProps {
  name: string
}

/**
 * Card payment for a deck box. New resources only: two secrets with placeholder
 * values, and two public function URLs. It does not change the GraphQL API,
 * the shop key, or any existing table, queue, or bucket.
 *
 * Replace the placeholder secret values in Secrets Manager. Leave this
 * template's REPLACE_ME strings as they are, or a later deploy will write the
 * placeholder back over the real keys.
 */
export class PaymentsStack extends Stack {
  constructor(app: App, id: string, props: PaymentsProps) {
    super(app, id)

    const ordersTableArn = Fn.importValue(`${props.name}-OrdersTable-Arn`)
    const ordersTableName = Fn.importValue(`${props.name}-OrdersTable-Name`)
    const placeholder = SecretValue.unsafePlainText('REPLACE_ME')

    const secretKey = new Secret(this, 'StripeSecretKey', {
      secretName: `${props.name}/stripe/secret-key`,
      description: 'Stripe secret key. Replace REPLACE_ME with the test key sk_test_...',
      secretStringValue: placeholder,
      removalPolicy: RemovalPolicy.RETAIN,
    })
    const webhookSecret = new Secret(this, 'StripeWebhookSecret', {
      secretName: `${props.name}/stripe/webhook-secret`,
      description: 'Stripe webhook signing secret. Replace REPLACE_ME with whsec_...',
      secretStringValue: placeholder,
      removalPolicy: RemovalPolicy.RETAIN,
    })

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
