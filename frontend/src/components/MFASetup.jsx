import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { QRCodeSVG } from 'qrcode.react';
import { CheckIcon } from '@heroicons/react/24/solid';
import { authService } from '../services/api';
import { PREVIEW_MODE } from '../config';
import PreviewNotice from './PreviewNotice';

const WRONG_CODE = "That code didn't work. Check your app and try again.";
const LOAD_FAILED = "Couldn't load two-step login. Refresh the page to try again.";

// Preview only: a made-up secret so the QR code and key render. Never sent anywhere.
const PREVIEW_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const PREVIEW_SETUP = {
  secret: PREVIEW_SECRET,
  otpauth_uri: `otpauth://totp/CVSU%20Alumni%3Apreview%40example.com?secret=${PREVIEW_SECRET}&issuer=CVSU%20Alumni&digits=6&period=30`,
};

const groupSecret = (secret) => (secret || '').replace(/\s+/g, '').match(/.{1,4}/g)?.join(' ') || '';

function StepNumber({ n, muted = false }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
        muted ? 'bg-slate-100 text-slate-400' : 'bg-cvsu-green text-white'
      }`}
    >
      {n}
    </span>
  );
}

StepNumber.propTypes = { n: PropTypes.number.isRequired, muted: PropTypes.bool };

function CodeField({ id, value, onChange, error, describedBy }) {
  return (
    <>
      <input
        id={id}
        name="code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : describedBy}
        className="form-input mt-2 w-full max-w-[14rem] text-center text-2xl tracking-[0.5em]"
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </>
  );
}

CodeField.propTypes = {
  id: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  error: PropTypes.string,
  describedBy: PropTypes.string,
};

export default function MFASetup() {
  // view: loading | setup | done | on | turning-off | error
  const [view, setView] = useState(PREVIEW_MODE ? 'setup' : 'loading');
  const [setup, setSetup] = useState(PREVIEW_MODE ? PREVIEW_SETUP : null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [previewTried, setPreviewTried] = useState(false);
  const [offNotice, setOffNotice] = useState(false);

  const startSetup = useCallback(async () => {
    const data = await authService.setupMFA();
    setSetup({ secret: data.secret, otpauth_uri: data.otpauth_uri || data.otpauth_url });
    setShowKey(false);
    setCopied(false);
    setCode('');
    setError('');
    setView('setup');
  }, []);

  useEffect(() => {
    if (PREVIEW_MODE) return undefined; // Preview never calls the API.
    let cancelled = false;
    (async () => {
      try {
        const status = await authService.getMFAStatus();
        if (cancelled) return;
        if (status?.is_enabled) setView('on');
        else await startSetup();
      } catch {
        if (!cancelled) setView('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [startSetup]);

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(setup.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const turnOn = async (e) => {
    e.preventDefault();
    setError('');
    if (PREVIEW_MODE) {
      setPreviewTried(true);
      return;
    }
    if (code.length !== 6) {
      setError(WRONG_CODE);
      return;
    }
    setBusy(true);
    try {
      await authService.enableMFA(code);
      setOffNotice(false);
      setView('done');
    } catch {
      setError(WRONG_CODE);
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async (e) => {
    e.preventDefault();
    setError('');
    if (code.length !== 6) {
      setError(WRONG_CODE);
      return;
    }
    setBusy(true);
    try {
      await authService.disableMFA(code);
      setOffNotice(true);
      await startSetup();
    } catch {
      setError(WRONG_CODE);
    } finally {
      setBusy(false);
    }
  };

  const card = 'rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8';

  if (view === 'loading') {
    return (
      <div className={card} aria-busy="true">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-cvsu-green" />
      </div>
    );
  }

  if (view === 'error') {
    return (
      <div className={card}>
        <p role="alert" className="text-sm text-red-600">{LOAD_FAILED}</p>
      </div>
    );
  }

  if (view === 'on' || view === 'turning-off') {
    return (
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CheckIcon className="h-5 w-5 text-green-600" aria-hidden="true" />
            Two-step login is on
          </p>
          {view === 'on' && (
            <button
              type="button"
              onClick={() => {
                setCode('');
                setError('');
                setView('turning-off');
              }}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Turn off
            </button>
          )}
        </div>
        {view === 'turning-off' && (
          <form className="mt-5 border-t border-slate-100 pt-5" onSubmit={turnOff} noValidate>
            <label htmlFor="mfa-off-code" className="block text-sm text-slate-700">
              Enter a code from your app to turn off two-step login.
            </label>
            <CodeField id="mfa-off-code" value={code} onChange={setCode} error={error} />
            <div className="mt-4 flex gap-3">
              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Turn off
              </button>
              <button
                type="button"
                onClick={() => setView('on')}
                className="px-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  const done = view === 'done';

  return (
    <section className={card} aria-labelledby="mfa-setup-title">
      {offNotice && (
        <p role="status" className="mb-5 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Two-step login is off.
        </p>
      )}
      <h2 id="mfa-setup-title" className="text-lg font-semibold text-slate-950">
        Turn on two-step login
      </h2>

      <ol className="mt-6 space-y-8">
        {!done && (
          <>
            <li className="flex gap-4">
              <StepNumber n={1} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-700">Scan this QR code with your authenticator app.</p>
                <div className="mt-4 flex justify-center">
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <QRCodeSVG
                      value={setup?.otpauth_uri || ''}
                      size={200}
                      level="M"
                      role="img"
                      aria-label="QR code for your authenticator app"
                    />
                  </div>
                </div>
                <div className="mt-4 text-center">
                  {!showKey ? (
                    <button
                      type="button"
                      onClick={() => setShowKey(true)}
                      className="text-sm font-semibold text-cvsu-green hover:text-cvsu-green/80"
                    >
                      Can&apos;t scan? Enter this key instead
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <code
                        aria-label={groupSecret(setup?.secret)}
                        className="flex max-w-full flex-wrap justify-center gap-x-2 gap-y-1 rounded-md bg-slate-50 px-3 py-2 font-mono text-sm tracking-wider text-slate-900"
                      >
                        {groupSecret(setup?.secret)
                          .split(' ')
                          .map((group, i) => (
                            <span key={i}>{group}</span>
                          ))}
                      </code>
                      <button
                        type="button"
                        onClick={copySecret}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        aria-live="polite"
                      >
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </li>

            <li className="flex gap-4">
              <StepNumber n={2} />
              <form className="min-w-0 flex-1" onSubmit={turnOn} noValidate>
                <label htmlFor="mfa-setup-code" className="block text-sm text-slate-700">
                  Enter the 6-digit code from your app.
                </label>
                <CodeField id="mfa-setup-code" value={code} onChange={setCode} error={error} />
                <button
                  type="submit"
                  disabled={busy || (!PREVIEW_MODE && code.length !== 6)}
                  className="btn-primary mt-4 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Turn on
                </button>
                {PREVIEW_MODE && previewTried && <PreviewNotice />}
              </form>
            </li>
          </>
        )}

        <li className="flex gap-4">
          {done ? (
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-white"
            >
              <CheckIcon className="h-4 w-4" />
            </span>
          ) : (
            <StepNumber n={3} muted />
          )}
          <div className="min-w-0 flex-1">
            {done ? (
              <>
                <p role="status" className="text-sm font-semibold text-slate-950">Two-step login is on.</p>
                <p className="mt-1 text-sm text-slate-600">
                  Next time you sign in, you&apos;ll enter a code from your app.
                </p>
              </>
            ) : (
              <p className="pt-1 text-sm text-slate-400">Done</p>
            )}
          </div>
        </li>
      </ol>

      {done && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <p className="text-sm font-semibold text-slate-900">Two-step login is on</p>
          <button
            type="button"
            onClick={() => {
              setCode('');
              setError('');
              setView('turning-off');
            }}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Turn off
          </button>
        </div>
      )}
    </section>
  );
}
