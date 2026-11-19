'use client';

import { FormEvent, useState } from 'react';
import {
  PASSWORD_RULES,
  confirmAdminNewPassword,
  confirmAdminReset,
  passwordProblems,
  sendAdminResetCode,
  startAdminSignIn,
  type NewPasswordChallenge,
} from '../lib/adminAuth';
import { adminConfigured } from '../lib/shopOrders';
import { missingShopConfig } from '../lib/publicConfig';

type Mode = 'sign-in' | 'new-password' | 'forgot' | 'reset';

const fieldClass = 'mt-1 min-h-11 w-full rounded-md border border-white/15 bg-[#1a1a2e] px-3';

export default function AdminSignInCard({
  intro,
  onSignedIn,
  onPreview,
}: {
  intro: string;
  onSignedIn: () => void;
  onPreview?: () => void;
}) {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<NewPasswordChallenge | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const missingConfig = missingShopConfig();
  const configured = adminConfigured();

  const fail = (caught: unknown) => {
    setError(caught instanceof Error ? caught.message : 'Sign-in failed');
  };

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const result = await startAdminSignIn(email, password);
      if (result.step === 'new-password') {
        setChallenge(result);
        setNextPassword('');
        setConfirm('');
        setMode('new-password');
        return;
      }
      onSignedIn();
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(false);
    }
  };

  const saveNewPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!challenge) return;
    const problems = passwordProblems(nextPassword, confirm);
    if (problems.length) {
      setError(problems.join(' '));
      return;
    }
    setError('');
    setBusy(true);
    try {
      await confirmAdminNewPassword(challenge, nextPassword);
      onSignedIn();
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(false);
    }
  };

  const sendCode = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      setNotice(await sendAdminResetCode(email));
      setCode('');
      setNextPassword('');
      setConfirm('');
      setMode('reset');
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(false);
    }
  };

  const saveReset = async (event: FormEvent) => {
    event.preventDefault();
    const problems = passwordProblems(nextPassword, confirm);
    if (!code.trim()) problems.unshift('Enter the code from the email.');
    if (problems.length) {
      setError(problems.join(' '));
      return;
    }
    setError('');
    setBusy(true);
    try {
      await confirmAdminReset(email, code, nextPassword);
      const result = await startAdminSignIn(email, nextPassword);
      if (result.step === 'new-password') {
        setChallenge(result);
        setMode('new-password');
        return;
      }
      onSignedIn();
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-full bg-[#12182c] px-4 py-10 text-white">
      <form
        onSubmit={(event) => {
          if (mode === 'new-password') void saveNewPassword(event);
          else if (mode === 'forgot') void sendCode(event);
          else if (mode === 'reset') void saveReset(event);
          else void signIn(event);
        }}
        className="mx-auto max-w-md space-y-3 rounded-xl border border-white/10 bg-black/30 p-6"
      >
        <h1 className="text-2xl font-bold text-[#e2c275]">Shop admin</h1>
        <p className="text-sm text-gray-300">{intro}</p>
        {missingConfig.length > 0 && (
          <p className="rounded-md border border-amber-300/40 bg-amber-950/40 p-3 text-sm text-amber-100">
            This build is missing {missingConfig.join(', ')}. Next reads those values when it builds, so set them in Amplify and rebuild. Sign-in stays disabled until then.
          </p>
        )}
        {mode === 'sign-in' && (
          <>
            <Field id="admin-email" label="Email" type="email" autoComplete="username" value={email} onChange={setEmail} />
            <Field id="admin-password" label="Password" type="password" autoComplete="current-password" value={password} onChange={setPassword} />
          </>
        )}
        {mode === 'new-password' && (
          <>
            <p className="text-sm text-gray-300">Choose a permanent password. This replaces the temporary one.</p>
            <PasswordRules />
            <Field id="admin-new-password" label="New password" type="password" autoComplete="new-password" value={nextPassword} onChange={setNextPassword} />
            <Field id="admin-confirm-password" label="Confirm password" type="password" autoComplete="new-password" value={confirm} onChange={setConfirm} />
          </>
        )}
        {mode === 'forgot' && (
          <>
            <p className="text-sm text-gray-300">A code goes to this admin email. This page does not create accounts.</p>
            <Field id="admin-email" label="Email" type="email" autoComplete="username" value={email} onChange={setEmail} />
          </>
        )}
        {mode === 'reset' && (
          <>
            <p className="text-sm text-gray-300">Enter the code from the email and a new password.</p>
            <PasswordRules />
            <Field id="admin-reset-code" label="Email code" type="text" autoComplete="one-time-code" value={code} onChange={setCode} />
            <Field id="admin-new-password" label="New password" type="password" autoComplete="new-password" value={nextPassword} onChange={setNextPassword} />
            <Field id="admin-confirm-password" label="Confirm password" type="password" autoComplete="new-password" value={confirm} onChange={setConfirm} />
          </>
        )}
        {notice && <p className="text-sm text-[#e2c275]">{notice}</p>}
        {error && <p className="rounded-md border border-amber-300/40 bg-amber-950/40 p-3 text-sm text-amber-100" role="alert">{error}</p>}
        <button type="submit" className="min-h-11 w-full rounded-md bg-[#e2c275] font-semibold text-black disabled:opacity-50" disabled={!configured || busy}>
          {mode === 'new-password' || mode === 'reset' ? 'Save password' : mode === 'forgot' ? 'Email me a code' : 'Sign in'}
        </button>
        {mode === 'sign-in' && (
          <button type="button" className="min-h-11 w-full text-sm text-[#e2c275] underline" onClick={() => { setError(''); setNotice(''); setMode('forgot'); }}>
            Forgot password?
          </button>
        )}
        {mode !== 'sign-in' && (
          <button type="button" className="min-h-11 w-full text-sm text-[#e2c275] underline" onClick={() => { setError(''); setNotice(''); setMode('sign-in'); }}>
            Back to sign in
          </button>
        )}
        {onPreview && !configured && (
          <button type="button" className="min-h-11 w-full rounded-md border border-white/20 text-sm" onClick={onPreview}>
            Preview orders in this browser
          </button>
        )}
      </form>
    </main>
  );
}

function PasswordRules() {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-gray-300">
      {PASSWORD_RULES.map((rule) => <li key={rule.id}>{rule.label}</li>)}
    </ul>
  );
}

function Field({
  id,
  label,
  type,
  autoComplete,
  value,
  onChange,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs text-gray-400" htmlFor={id}>{label}
      <input id={id} type={type} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass} />
    </label>
  );
}
