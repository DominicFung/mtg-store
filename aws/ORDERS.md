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

The profile routes across those three regions. The outpaint is one-sided: pixels are added on the left or the right, never both, and never up or down. The subject is measured on the original art. A figure on the left is extended to the right so the default crop keeps them on the left face; a figure on the right is extended to the left so they land on the right. A centred figure such as Brigid stays on the left. Pass `side: "left"` or `side: "right"` to force the other edge. Each direction is cached on its own at `outpaint/v2/<side>/<hash>.png`, and the other side is generated only when the shop asks for it.

The shop route `/api/outpaint` calls this query, then returns the PNG as a data URL. The browser never paints the signed S3 URL, so the crop canvas is not tainted. The order bucket already allows `GET` from any origin; no S3 or CloudFront change is required for the crop. Objects are stored with `Cache-Control: private, no-store` so a non-CORS response is not reused.

If the model is not enabled, or the call fails, the Lambda stores the one-sided edge extension instead so the crop step can continue.

Deploy `mtgstore-AppsyncStack` before the Amplify web app. That stack publishes the `side` argument and the subject fields on `outpaintCommanderArt`, and replaces the outpaint Lambda. Until that deploy, the web route falls back to the same one-sided edge extension and does not call Bedrock.

## Lid colours

The designer sends an optional `lid` object on `submitOrder`: box filament, Magic logo filament, and an optional name with its filament. `OrderDetail.lid` is the same shape. Older orders leave it null. No table, API, key, or user pool is replaced.

Deploy **`mtgstore-AppsyncStack` before the Amplify web build.** That stack publishes the new input and the `OrderLid` fields, and replaces the submit, track, and admin order Lambdas. Until it deploys, a web build that sends `lid` is rejected by AppSync.

Deploy **`mtgstore-OrdersStack`** as well so the generator writes the lid files into the zip. It can deploy before or after the web build. It does not change the API. The zip Dominic downloads contains `box-body.stl`, `lid-base.stl`, `lid-spark.stl`, `lid-text.stl` when the lid has a name, and `lid-colours.txt`. Customers still only see the receipt and the tracking page.

## Payments

A new box is **CA$55** (`BOX_PRICE_CENTS` is 5500). New orders are stored as `UNPAID`. The Stripe webhook sets `paymentStatus` to `PAID`. Older rows may still say `NOT_CONNECTED`. Customers still never receive print files. The shop notice still goes to the `notifyEmail` used at deploy.

Card payment is a separate stack, `mtgstore-PaymentsStack`. It adds two public function URLs. It looks up the Stripe secrets by name and does not write their values. It does not replace the GraphQL API, `ShopApiKey20261112`, the Dynamo tables, the queues, or the buckets.

```bash
npx cdk deploy mtgstore-PaymentsStack -c notifyEmail=you@example.com --require-approval broadening
```

The first deploy created `mtgstore/stripe/secret-key` and `mtgstore/stripe/webhook-secret` with `DeletionPolicy: Retain`. Later deploys only reference those names. CloudFormation does not reset the stored values. Until the secret key is a real `sk_test_...` value, and until the web build has a real publishable key and the checkout URL, the checkout step says "Online payment coming soon" and the pay button stays off. The address check still runs. The Lambdas answer `payments not configured` instead of crashing.

Set or replace the keys in the console. A deploy will not overwrite them.

```bash
aws secretsmanager put-secret-value \
  --secret-id mtgstore/stripe/secret-key \
  --secret-string 'sk_test_...' \
  --region us-east-1

aws secretsmanager put-secret-value \
  --secret-id mtgstore/stripe/webhook-secret \
  --secret-string 'whsec_...' \
  --region us-east-1
```

Use Stripe test mode. In the Stripe dashboard, add a webhook endpoint for the `StripeWebhookUrl` output and subscribe to `checkout.session.completed`. Put that endpoint's signing secret in `mtgstore/stripe/webhook-secret`.

Amplify build environment, then rebuild the web app:

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_PAYMENTS_URL=<CheckoutUrl output>
```

A placeholder such as `pk_test_REPLACE_ME`, or a missing URL, keeps the coming-soon state.

When Stripe marks an order paid, the shop address in `notifyEmail` receives one email. It links to `https://themanaramp.ca/admin/orders/<orderId>` and does not include a file link. That page asks for the Cognito admin sign-in. `getAdminOrder` and `refreshDownloadLinks` are admin-group only and mint a new short-lived download each time. Print files stay in the private order bucket, which has no expiry rule. The customer receives a receipt email with the tracking link and no files. Stripe Checkout also sets `customer_email` and `payment_intent_data[receipt_email]` so a Stripe receipt can be turned on in the dashboard.

SES is still in the sandbox until production access is granted. The From address is the verified `notifyEmail` identity. In the sandbox the customer's address must be verified too, or the receipt email fails and the order stores `customerNotifyError`. Request production access in SES, or verify each customer address, before customer receipts can reach anyone else.

## Fulfillment

`/admin` lists orders newest first: order number, customer, date, paid or not, and the current step, with a link to `/admin/orders/<orderId>`. Both pages have one button that walks Received, Printing, Ready to ship, Out for delivery, then Delivered. The list asks for a confirm tap. Either page can undo the last step. Each move appends the existing history array with a timestamp.

Delivered is not a plain status change. The order must already be out for delivery, and the button opens the phone camera (`accept="image/*"` and `capture="environment"`). The page shrinks the photo in the browser, asks `requestDeliveryPhotoUpload` for an admin-only presigned PUT, stores the object at `orders/<orderId>/delivery/<timestamp>.jpg` in the private order bucket, then `confirmDelivery` saves that key. Tracking shows the photo only after delivery, through a one-hour presigned GET minted by `trackOrder` for that order number and email. `downloadUrl` and `profileSnapshotJson` stay null on that response.

Shipped and Delivered also email the customer through the existing SES identity. The message links to the tracking page and does not attach the photo or any print file. The same sandbox limit applies: an unverified customer address fails, and the order stores `customerNotifyError`. Other status mail still waits for `-c customerStatusEmails=true`.

Delivery is in person only. The postal-code FSA decides when one is present: Toronto is every `M` code (including North York, Scarborough, East York, York, and Etobicoke `M8`/`M9`), Mississauga is `L4T L4V L4W L4X L4Y L4Z` and `L5A L5B L5C L5E L5G L5H L5J L5K L5L L5M L5N L5P L5R L5S L5T L5V L5W`, and Milton is `L9T` and `L9E`. A city name is used only when the postal code is missing.
