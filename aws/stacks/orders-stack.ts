import { App, CfnOutput, Duration, Fn, RemovalPolicy, Size, Stack } from 'aws-cdk-lib'
import { Alarm, ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch'
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions'
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'
import { Runtime } from 'aws-cdk-lib/aws-lambda'
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { BlockPublicAccess, Bucket, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3'
import { CfnEmailIdentity } from 'aws-cdk-lib/aws-ses'
import { Subscription, SubscriptionProtocol, Topic } from 'aws-cdk-lib/aws-sns'
import { Queue } from 'aws-cdk-lib/aws-sqs'
import { join } from 'path'

interface OrdersProps {
  name: string
  notifyEmail: string
  customerStatusEmails: boolean
}

/**
 * Private print files, the generation queue, and the notice to Dominic.
 * Additive: this does not replace the public shop bucket.
 */
export class OrdersStack extends Stack {
  constructor(app: App, id: string, props: OrdersProps) {
    super(app, id)

    const ordersTableArn = Fn.importValue(`${props.name}-OrdersTable-Arn`)
    const ordersTableName = Fn.importValue(`${props.name}-OrdersTable-Name`)

    const bucket = new Bucket(this, 'OrderFiles', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
      cors: [{
        allowedMethods: [HttpMethods.PUT, HttpMethods.GET, HttpMethods.HEAD],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
        exposedHeaders: ['ETag'],
        maxAge: 3000,
      }],
    })

    const deadLetter = new Queue(this, 'GenerateDlq', {
      retentionPeriod: Duration.days(14),
      visibilityTimeout: Duration.minutes(2),
    })
    const queue = new Queue(this, 'GenerateQueue', {
      visibilityTimeout: Duration.minutes(16),
      retentionPeriod: Duration.days(4),
      deadLetterQueue: { queue: deadLetter, maxReceiveCount: 3 },
    })

    const topic = new Topic(this, 'OrderNotify', {
      displayName: 'Mana Ramp orders',
    })
    new Subscription(this, 'OrderNotifyEmail', {
      topic,
      protocol: SubscriptionProtocol.EMAIL,
      endpoint: props.notifyEmail,
    })
    // Deploy sends a verification email. Sandbox accounts must also verify the recipient.
    new CfnEmailIdentity(this, 'NotifyFrom', { emailIdentity: props.notifyEmail })

    const alarm = new Alarm(this, 'GenerateDlqAlarm', {
      metric: deadLetter.metricApproximateNumberOfMessagesVisible({ period: Duration.minutes(1) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
      alarmDescription: 'A deck-box order failed to generate print files and is on the dead-letter queue.',
    })
    alarm.addAlarmAction(new SnsAction(topic))

    const shared = {
      bundling: { bundleAwsSDK: true },
      depsLockFilePath: join(__dirname, '../lambdas', 'package-lock.json'),
      runtime: Runtime.NODEJS_22_X,
      environment: {
        ORDERS_TABLE_NAME: ordersTableName,
        ORDER_BUCKET_NAME: bucket.bucketName,
        NOTIFY_EMAIL: props.notifyEmail,
        NOTIFY_TOPIC_ARN: topic.topicArn,
        CUSTOMER_STATUS_EMAILS: props.customerStatusEmails ? 'true' : 'false',
        PRESIGN_TTL_SECONDS: String(4 * 60 * 60),
      },
    }

    const generator = new NodejsFunction(this, `${props.name}-GenerateOrder`, {
      entry: join(__dirname, '../lambdas', 'generate', 'handler.ts'),
      timeout: Duration.minutes(15),
      memorySize: 4096,
      ephemeralStorageSize: Size.gibibytes(2),
      reservedConcurrentExecutions: 2,
      ...shared,
    })
    const fail = new NodejsFunction(this, `${props.name}-FailOrder`, {
      entry: join(__dirname, '../lambdas', 'generate', 'fail.ts'),
      timeout: Duration.seconds(30),
      memorySize: 256,
      ...shared,
    })

    generator.addEventSource(new SqsEventSource(queue, { batchSize: 1, reportBatchItemFailures: true }))
    fail.addEventSource(new SqsEventSource(deadLetter, { batchSize: 1 }))

    const tableResources = [ordersTableArn, `${ordersTableArn}/index/*`]
    for (const fn of [generator, fail]) {
      fn.addToRolePolicy(new PolicyStatement({
        actions: ['dynamodb:GetItem', 'dynamodb:UpdateItem', 'dynamodb:Query'],
        resources: tableResources,
      }))
      bucket.grantReadWrite(fn)
      topic.grantPublish(fn)
      fn.addToRolePolicy(new PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      }))
    }

    new CfnOutput(this, `${props.name}-OrderBucketName`, {
      value: bucket.bucketName,
      exportName: `${props.name}-OrderBucketName`,
    })
    new CfnOutput(this, `${props.name}-OrderBucketArn`, {
      value: bucket.bucketArn,
      exportName: `${props.name}-OrderBucketArn`,
    })
    new CfnOutput(this, `${props.name}-OrderQueueUrl`, {
      value: queue.queueUrl,
      exportName: `${props.name}-OrderQueueUrl`,
    })
    new CfnOutput(this, `${props.name}-OrderQueueArn`, {
      value: queue.queueArn,
      exportName: `${props.name}-OrderQueueArn`,
    })
    new CfnOutput(this, `${props.name}-NotifyTopicArn`, {
      value: topic.topicArn,
      exportName: `${props.name}-NotifyTopicArn`,
    })
  }
}
