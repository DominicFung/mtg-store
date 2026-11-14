import { App, CfnOutput, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib'
import { AccountRecovery, CfnUserPoolGroup, UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito'

interface AuthProps {
  name: string
}

/**
 * One user pool for Dominic. Self sign-up is off. The `admin` group is the
 * only group the shop mutations accept.
 */
export class AuthStack extends Stack {
  constructor(app: App, id: string, props: AuthProps) {
    super(app, id)

    const pool = new UserPool(this, 'AdminPool', {
      userPoolName: `${props.name}-admins`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      passwordPolicy: {
        minLength: 12,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: true,
        requireSymbols: true,
        tempPasswordValidity: Duration.days(7),
      },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.RETAIN,
    })

    const client = new UserPoolClient(this, 'AdminWebClient', {
      userPool: pool,
      authFlows: { userPassword: true, userSrp: true },
      preventUserExistenceErrors: true,
      generateSecret: false,
      accessTokenValidity: Duration.hours(8),
      idTokenValidity: Duration.hours(8),
    })

    new CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: pool.userPoolId,
      groupName: 'admin',
      description: 'Shop owner. Can manage orders, print files, and nozzle profiles.',
    })

    new CfnOutput(this, `${props.name}-UserPoolId`, {
      value: pool.userPoolId,
      exportName: `${props.name}-UserPoolId`,
    })
    new CfnOutput(this, `${props.name}-UserPoolClientId`, {
      value: client.userPoolClientId,
      exportName: `${props.name}-UserPoolClientId`,
    })
  }
}
