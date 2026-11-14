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

The web app reads these at `next build` time. Next inlines `NEXT_PUBLIC_*`, so set them in the Amplify build environment and rebuild. A missing value does not fail the build. `/admin` lists whichever of these were empty:

```bash
NEXT_PUBLIC_APPSYNC_URL=https://imsyvldjf5b5fj556fasjpedk4.appsync-api.us-east-1.amazonaws.com/graphql
NEXT_PUBLIC_APPSYNC_API_KEY=<ShopApiKey20261112 output>
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_gObjyRZy0
NEXT_PUBLIC_COGNITO_CLIENT_ID=58evb4g4qv5b3ue4n7bqaoo2n
NEXT_PUBLIC_AWS_REGION=us-east-1
```

`NEXT_PUBLIC_APPSYNC_URL` is the existing GraphQL endpoint. The API key is the shop key output, not the expired default key. `ShopApiKey20261112` expires at epoch `1826204400`, so a later deploy does not replace it.

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

`outpaintCommanderArt` calls Stability Image Outpaint. The model id is `BEDROCK_IMAGE_MODEL` on the Lambda, set from CDK context `bedrockImageModel`. The default is the US geo profile `us.stability.stable-outpaint-v1:0` (foundation model `stability.stable-outpaint-v1:0`). Override it with `-c bedrockImageModel=...` if AWS publishes a newer id.

Nova Canvas and Titan Image Generator v2 are end of life and are not used. In the Bedrock console for us-east-1, enable Stable Image Outpaint before the first live commander search. The Lambda role may call `bedrock:InvokeModel` on:

- `arn:aws:bedrock:us-east-1:<account>:inference-profile/us.stability.stable-outpaint-v1:0`
- `arn:aws:bedrock:us-east-1::foundation-model/stability.stable-outpaint-v1:0`
- `arn:aws:bedrock:us-east-2::foundation-model/stability.stable-outpaint-v1:0`
- `arn:aws:bedrock:us-west-2::foundation-model/stability.stable-outpaint-v1:0`

The profile routes across those three regions. Results are cached in the private order bucket. If the model is not enabled, or the call fails, the Lambda stores the edge extension instead so the crop step can continue.

## Payments

`paymentStatus` is `NOT_CONNECTED`. The hook is the comment marked `PAYMENT_HOOK` in `submitOrder`. Price on the receipt is "Price confirmed before printing".
