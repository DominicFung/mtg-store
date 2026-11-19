import { publicConfig } from './publicConfig';
import { saveAdminToken } from './shopOrders';

/** Matches the admin user pool: 12 characters, upper, lower, number, and symbol. */
export const PASSWORD_RULES: ReadonlyArray<{ id: string; label: string; test: (password: string) => boolean }> = [
  { id: 'length', label: 'At least 12 characters', test: (password) => password.length >= 12 },
  { id: 'lower', label: 'One lowercase letter', test: (password) => /[a-z]/.test(password) },
  { id: 'upper', label: 'One uppercase letter', test: (password) => /[A-Z]/.test(password) },
  { id: 'digit', label: 'One number', test: (password) => /\d/.test(password) },
  { id: 'symbol', label: 'One symbol', test: (password) => /[^A-Za-z0-9]/.test(password) },
];

export type NewPasswordChallenge = {
  step: 'new-password';
  session: string;
  username: string;
  email: string;
  requiredAttributes: string[];
};

type CognitoBody = {
  __type?: string;
  message?: string;
  Message?: string;
  ChallengeName?: string;
  Session?: string;
  ChallengeParameters?: { USER_ID_FOR_SRP?: string; requiredAttributes?: string };
  AuthenticationResult?: { IdToken?: string };
  CodeDeliveryDetails?: { Destination?: string };
};

export function passwordProblems(password: string, confirm: string): string[] {
  if (!password) return ['Enter a new password.'];
  const failed = PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.label);
  if (password !== confirm) failed.push('The two passwords do not match.');
  return failed;
}

export function explainCognitoError(body: { __type?: string; message?: string; Message?: string }): string {
  const type = String(body.__type ?? '').split('#').pop() ?? '';
  const message = body.message || body.Message || '';
  if (/temporary password has expired/i.test(message)) {
    return 'This temporary password has expired. A new temporary password has to be issued before you can choose a permanent one on this page.';
  }
  if (/cannot be reset in the current state/i.test(message)) {
    return 'This account still uses a temporary password. Sign in with it and set a permanent password on this page. If that temporary password has expired, a new one has to be issued.';
  }
  if (/invalid session|session is expired/i.test(message)) {
    return 'That sign-in expired. Enter the temporary password again.';
  }
  if (type === 'PasswordResetRequiredException') {
    return 'This password has to be reset. Use Forgot password and the code from your email.';
  }
  if (type === 'CodeMismatchException') return 'That code does not match. Check the email and try again.';
  if (type === 'ExpiredCodeException') return 'That code has expired. Request a new one.';
  if (type === 'LimitExceededException' || type === 'TooManyRequestsException' || type === 'TooManyFailedAttemptsException') {
    return 'Too many attempts. Wait a few minutes and try again.';
  }
  if (type === 'InvalidPasswordException') return message || 'That password does not meet the rules above.';
  if (type === 'NotAuthorizedException' || type === 'UserNotFoundException') return 'Email or password is incorrect.';
  return message || 'Sign-in failed';
}

async function cognito(target: string, payload: Record<string, unknown>): Promise<CognitoBody> {
  const clientId = publicConfig.cognitoClientId;
  const region = publicConfig.awsRegion || 'us-east-1';
  if (!clientId) throw new Error('Cognito is not configured in this session');
  let response: Response;
  try {
    response = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-amz-json-1.1',
        'x-amz-target': `AWSCognitoIdentityProviderService.${target}`,
      },
      body: JSON.stringify({ ClientId: clientId, ...payload }),
    });
  } catch {
    throw new Error('Could not reach the sign-in service.');
  }
  const body = await response.json() as CognitoBody;
  if (!response.ok) throw new Error(explainCognitoError(body));
  return body;
}

function requiredAttributeNames(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function storeSession(body: CognitoBody) {
  const token = body.AuthenticationResult?.IdToken;
  if (!token) throw new Error('Sign-in did not return a session. Try again.');
  saveAdminToken(token);
}

export async function startAdminSignIn(email: string, password: string): Promise<NewPasswordChallenge | { step: 'done' }> {
  const username = email.trim();
  const body = await cognito('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: { USERNAME: username, PASSWORD: password },
  });
  if (body.ChallengeName === 'NEW_PASSWORD_REQUIRED' && body.Session) {
    return {
      step: 'new-password',
      session: body.Session,
      username: body.ChallengeParameters?.USER_ID_FOR_SRP || username,
      email: username,
      requiredAttributes: requiredAttributeNames(body.ChallengeParameters?.requiredAttributes),
    };
  }
  if (body.ChallengeName) {
    throw new Error(`Sign-in stopped at ${body.ChallengeName}. Try again, or use Forgot password.`);
  }
  storeSession(body);
  return { step: 'done' };
}

export async function confirmAdminNewPassword(challenge: NewPasswordChallenge, password: string): Promise<void> {
  const responses: Record<string, string> = {
    USERNAME: challenge.username,
    NEW_PASSWORD: password,
  };
  if (challenge.requiredAttributes.includes('email')) responses['userAttributes.email'] = challenge.email;
  const body = await cognito('RespondToAuthChallenge', {
    ChallengeName: 'NEW_PASSWORD_REQUIRED',
    Session: challenge.session,
    ChallengeResponses: responses,
  });
  if (body.ChallengeName) {
    throw new Error(`Sign-in stopped at ${body.ChallengeName}. Try again.`);
  }
  storeSession(body);
}

export async function sendAdminResetCode(email: string): Promise<string> {
  const body = await cognito('ForgotPassword', { Username: email.trim() });
  const destination = body.CodeDeliveryDetails?.Destination;
  return destination
    ? `A code was sent to ${destination}.`
    : 'If this admin email can receive mail, a code is on the way.';
}

export async function confirmAdminReset(email: string, code: string, password: string): Promise<void> {
  await cognito('ConfirmForgotPassword', {
    Username: email.trim(),
    ConfirmationCode: code.trim(),
    Password: password,
  });
}
