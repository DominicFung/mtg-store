import assert from 'node:assert/strict';
import { test } from 'node:test';
import { explainCognitoError, passwordProblems } from './adminAuth';

const strong = 'Deckbox-55-Gold';

test('a permanent password must match the pool rules and the confirmation', () => {
  assert.deepEqual(passwordProblems('', ''), ['Enter a new password.']);
  assert.ok(passwordProblems('short', 'short').includes('At least 12 characters'));
  assert.ok(passwordProblems('longenough!!', 'longenough!!').includes('One uppercase letter'));
  assert.ok(passwordProblems('Longenough!!', 'Longenough!!').includes('One number'));
  assert.ok(passwordProblems('Longenough55', 'Longenough55').includes('One symbol'));
  assert.deepEqual(passwordProblems(strong, 'Deckbox-55-Silver'), ['The two passwords do not match.']);
  assert.deepEqual(passwordProblems(strong, strong), []);
});

test('an expired temporary password is explained without sending anyone to a CLI', () => {
  const text = explainCognitoError({
    __type: 'NotAuthorizedException',
    message: 'Temporary password has expired and must be reset by an administrator.',
  });
  assert.match(text, /temporary password has expired/i);
  assert.equal(text.toLowerCase().includes('cli'), false);
});

test('reset and code errors stay specific', () => {
  assert.match(explainCognitoError({ __type: 'CodeMismatchException', message: 'Invalid code' }), /does not match/);
  assert.match(explainCognitoError({ __type: 'ExpiredCodeException', message: 'expired' }), /expired/);
  assert.match(
    explainCognitoError({ __type: 'NotAuthorizedException', message: 'User password cannot be reset in the current state.' }),
    /temporary password/i,
  );
  assert.equal(
    explainCognitoError({ __type: 'InvalidPasswordException', message: 'Password must have symbol characters' }),
    'Password must have symbol characters',
  );
});
