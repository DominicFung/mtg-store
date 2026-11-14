/**
 * Next inlines NEXT_PUBLIC_* when this module is built. Each name is a direct
 * property read so a missing value becomes an empty string instead of a
 * build error. Set them in the Amplify build environment, then rebuild.
 *
 * NEXT_PUBLIC_APPSYNC_URL=https://imsyvldjf5b5fj556fasjpedk4.appsync-api.us-east-1.amazonaws.com/graphql
 * NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_gObjyRZy0
 * NEXT_PUBLIC_COGNITO_CLIENT_ID=58evb4g4qv5b3ue4n7bqaoo2n
 * NEXT_PUBLIC_AWS_REGION=us-east-1
 * NEXT_PUBLIC_APPSYNC_API_KEY is the ShopApiKey20261112 output.
 */
export const publicConfig = {
  appsyncUrl: process.env.NEXT_PUBLIC_APPSYNC_URL ?? '',
  appsyncApiKey: process.env.NEXT_PUBLIC_APPSYNC_API_KEY ?? '',
  cognitoUserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? '',
  cognitoClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? '',
  awsRegion: process.env.NEXT_PUBLIC_AWS_REGION ?? '',
};

export function missingShopConfig(): string[] {
  const missing: string[] = [];
  if (!publicConfig.appsyncUrl) missing.push('NEXT_PUBLIC_APPSYNC_URL');
  if (!publicConfig.cognitoUserPoolId) missing.push('NEXT_PUBLIC_COGNITO_USER_POOL_ID');
  if (!publicConfig.cognitoClientId) missing.push('NEXT_PUBLIC_COGNITO_CLIENT_ID');
  if (!publicConfig.awsRegion) missing.push('NEXT_PUBLIC_AWS_REGION');
  return missing;
}
