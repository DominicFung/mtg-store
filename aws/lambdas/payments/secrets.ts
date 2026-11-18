import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({});

/** Empty when the secret is missing. Callers treat placeholders as not configured. */
export async function readSecret(secretId: string | undefined): Promise<string> {
  if (!secretId) return '';
  try {
    const result = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
    return result.SecretString ?? '';
  } catch {
    return '';
  }
}
