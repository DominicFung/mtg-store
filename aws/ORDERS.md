# Orders, admin, and print files

Do not give customers STL files. The shop prints the Commander Deck Box. `submitOrder` stores the crops and a snapshot of the nozzle profile, then a queue runs the same mesh code the preview uses.

## Deploy

Account `006033392195`, region `us-east-1`. Additive stacks only. Do not replace the GraphQL API, `ShopApiKey20261112`, `FilamentTable`, or `PrintSettingsTable`.

From `aws/`, with the address that should receive SES mail and the admin notice:

```bash
npx cdk synth -c notifyEmail=you@example.com
npx cdk deploy mtgstore-DynamoStack -c notifyEmail=you@example.com --require-approval broadening
npx cdk deploy mtgstore-AuthStack -c notifyEmail=you@example.com --require-approval broadening
npx cdk deploy mtgstore-OrdersStack -c notifyEmail=you@example.com --require-approval broadening
npx cdk deploy mtgstore-AppsyncStack -c notifyEmail=you@example.com --require-approval broadening
```

Leave `mtgstore-S3Stack` and `mtgstore-IamStack` alone unless you mean to change the public bucket.

Then seed, from `aws/lambdas`:

```bash
AWS_REGION=us-east-1 FILAMENT_TABLE_NAME=mtgstore-FilamentTable npm run seed:filaments
AWS_REGION=us-east-1 \
  NOZZLE_PROFILES_TABLE_NAME=mtgstore-NozzleProfilesTable \
  PRINT_SETTINGS_TABLE_NAME=mtgstore-PrintSettingsTable \
  npm run seed:nozzle-profiles
```

The 0.2 mm profile is the default and is copied onto the existing print-settings row. Border width and border depth are 0. The mesh never extrudes a border.

Set the web env from the stack outputs: `NEXT_PUBLIC_APPSYNC_URL`, `NEXT_PUBLIC_APPSYNC_API_KEY` (the shop key output, not the expired default key), `NEXT_PUBLIC_COGNITO_USER_POOL_ID`, `NEXT_PUBLIC_COGNITO_CLIENT_ID`, `NEXT_PUBLIC_AWS_REGION=us-east-1`.

## One admin user

The pool has self sign-up disabled (`AllowAdminCreateUserOnly`). Only the `admin` group can call admin queries and mutations. Each of those Lambdas checks the group again. The API key cannot call them: the schema marks them `@aws_cognito_user_pools(cognito_groups: ["admin"])`.

Create Dominic's user and put him in that group. Replace the pool id from the Auth stack output. There is only this one user.

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <pool-id> \
  --username you@example.com \
  --user-attributes Name=email,Value=you@example.com Name=email_verified,Value=true \
  --message-action SUPPRESS \
  --region us-east-1

aws cognito-idp admin-set-user-password \
  --user-pool-id <pool-id> \
  --username you@example.com \
  --password '<a 12+ character password>' \
  --permanent \
  --region us-east-1

aws cognito-idp admin-add-user-to-group \
  --user-pool-id <pool-id> \
  --username you@example.com \
  --group-name admin \
  --region us-east-1
```

Sign in at `/admin` with that email. Customer status email is off unless you deploy with `-c customerStatusEmails=true`.

## SES

Deploy creates an SES email identity and an SNS email subscription for `notifyEmail`. Confirm both messages. In the SES sandbox the recipient must be verified too. If SES rejects the send, the generator publishes the same notice to the SNS topic. Download links last about four hours and can be created again from the admin order.

## Bedrock outpaint

`outpaintCommanderArt` tries Amazon Nova Canvas (`amazon.nova-canvas-v1:0`) in us-east-1, then Titan Image Generator v2 (`amazon.titan-image-generator-v2:0`). In the Bedrock console, open Model access for us-east-1 and enable those two models before the first commander search against the API. Results are cached in the private order bucket. If the model is not enabled, the Lambda still returns an edge extension so the crop step can continue.

## Payments

`paymentStatus` is `NOT_CONNECTED`. The hook is the comment marked `PAYMENT_HOOK` in `submitOrder`. Price on the receipt is "Price confirmed before printing".
