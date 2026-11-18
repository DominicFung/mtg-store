import { App } from 'aws-cdk-lib'

import { S3Stack } from './stacks/s3-stack'
import { DynamoStack } from './stacks/dynamo-stack'
import { AppsyncStack } from './stacks/appsync-stack'
import { IamStack } from './stacks/iam-stack'
import { AuthStack } from './stacks/auth-stack'
import { OrdersStack } from './stacks/orders-stack'
import { PaymentsStack } from './stacks/payments-stack'

const PROJECT_NAME = 'mtgstore'

const app = new App()
const notifyEmail = String(app.node.tryGetContext('notifyEmail') ?? '')
if (!notifyEmail.includes('@')) {
  throw new Error('Pass -c notifyEmail=you@example.com so SES and the admin notice use your address.')
}
const customerStatusEmails = app.node.tryGetContext('customerStatusEmails') === true
  || app.node.tryGetContext('customerStatusEmails') === 'true'
const bedrockImageModel = String(
  app.node.tryGetContext('bedrockImageModel') ?? 'us.stability.stable-outpaint-v1:0',
)

const s3Stack = new S3Stack(app, `${PROJECT_NAME}-S3Stack`, { name: PROJECT_NAME })
const dynamoStack = new DynamoStack(app, `${PROJECT_NAME}-DynamoStack`, { name: PROJECT_NAME })
const authStack = new AuthStack(app, `${PROJECT_NAME}-AuthStack`, { name: PROJECT_NAME })
const ordersStack = new OrdersStack(app, `${PROJECT_NAME}-OrdersStack`, {
  name: PROJECT_NAME,
  notifyEmail,
  customerStatusEmails,
})
ordersStack.addDependency(dynamoStack)

const paymentsStack = new PaymentsStack(app, `${PROJECT_NAME}-PaymentsStack`, { name: PROJECT_NAME })
paymentsStack.addDependency(dynamoStack)

const appsyncStack = new AppsyncStack(app, `${PROJECT_NAME}-AppsyncStack`, {
  name: PROJECT_NAME,
  notifyEmail,
  customerStatusEmails,
  bedrockImageModel,
})
appsyncStack.addDependency(dynamoStack)
appsyncStack.addDependency(authStack)
appsyncStack.addDependency(ordersStack)

const iamStack = new IamStack(app, `${PROJECT_NAME}-IamStack`, { name: PROJECT_NAME})
iamStack.addDependency(s3Stack)

app.synth()