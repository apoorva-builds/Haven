import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandLogo } from '../components/Brand';
import { Icon } from '../components/Icon';
import '../styles/login.css';

/*
 * A UI-only sample of Haven's sign-in. Nothing here authenticates anyone:
 * no request is made, nothing is written to storage, and the password and
 * personal sentence live only in this component's memory until the flow
 * finishes or the page is left. The "Face ID / passkey" step is simulated
 * and never touches a camera or biometric API. The signature colour only
 * personalises the welcome; it is not a sign-in factor. Production sign-in
 * will use password authentication plus WebAuthn passkeys.
 */

const STEPS = ['Account', 'Signature', 'Passkey', 'Sentence', 'Welcome'] as const;

export const SIGNATURE_SWATCHES = [
  { id: 'porcelain', name: 'Porcelain', hex: '#f3e6d8', ink: '#433732' },
  { id: 'nude', name: 'Pale nude', hex: '#edd7c7', ink: '#433732' },
  { id: 'rose', name: 'Champagne rose', hex: '#d7a58c', ink: '#3a2a24' },
  { id: 'greige', name: 'Soft greige', hex: '#cfbfb5', ink: '#433732' },
  { id: 'taupe', name: 'Mauve taupe', hex: '#9b8178', ink: '#fffdfa' },
  { id: 'mocha', name: 'Mocha', hex: '#6f554d', ink: '#fffdfa' },
] as const;
type SwatchId = (typeof SIGNATURE_SWATCHES)[number]['id'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const MIN_SENTENCE = 12;

export function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd');

  // Held in memory only, for moving back and forth between steps.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [swatch, setSwatch] = useState<SwatchId | null>(null);
  const [passkey, setPasskey] = useState<'idle' | 'checking' | 'done'>('idle');
  const [sentence, setSentence] = useState('');

  const headingRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useEffect(() => {
    // Move focus to each new step's heading, but not on first load.
    if (first.current) {
      first.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  // The secrets are never kept past the end of the flow.
  useEffect(() => {
    if (step === STEPS.length - 1) {
      setPassword('');
      setSentence('');
    }
  }, [step]);

  const go = (to: number) => {
    setDir(to > step ? 'fwd' : 'back');
    setStep(to);
  };
  const next = () => go(step + 1);
  const back = () => go(step - 1);

  const chosen = SIGNATURE_SWATCHES.find((s) => s.id === swatch);

  return (
    <div className="login" style={chosen ? { ['--sig' as string]: chosen.hex } : undefined}>
      <aside className="login__brand" aria-hidden="true">
        <BrandLogo variant="symbol" height={96} className="login__mark" decorative />
        <p className="login__tagline">Creators belong here.</p>
      </aside>

      <main className="login__main">
        <header className="login__top">
          <BrandLogo variant="horizontal" height={34} />
          <span className="login__demo">
            <span className="login__demo-dot" aria-hidden="true" />
            Sample sign-in · UI only
          </span>
        </header>

        <div className="login__card">
          <Progress step={step} />

          <div key={step} className={`login__step login__step--${dir}`}>
            {step === 0 && (
              <AccountStep headingRef={headingRef} email={email} setEmail={setEmail} password={password} setPassword={setPassword} onNext={next} />
            )}
            {step === 1 && <SignatureStep headingRef={headingRef} swatch={swatch} setSwatch={setSwatch} onBack={back} onNext={next} />}
            {step === 2 && <PasskeyStep headingRef={headingRef} status={passkey} setStatus={setPasskey} onBack={back} onNext={next} />}
            {step === 3 && <SentenceStep headingRef={headingRef} sentence={sentence} setSentence={setSentence} onBack={back} onNext={next} />}
            {step === 4 && <WelcomeStep headingRef={headingRef} email={email} swatchName={chosen?.name} onEnter={() => navigate('/')} />}
          </div>
        </div>

        <p className="login__fineprint">
          This is a design preview. Nothing you enter is sent or saved, and no camera or biometric data is used. Please don’t enter a real password. Haven’s real
          sign-in will use a secure password and passkeys (WebAuthn).
        </p>
      </main>
    </div>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <nav className="lprog" aria-label="Sign-in progress">
      <p className="lprog__count">
        Step {step + 1} of {STEPS.length}
      </p>
      <ol className="lprog__list">
        {STEPS.map((label, i) => (
          <li key={label} className={`lprog__item${i < step ? ' is-done' : ''}${i === step ? ' is-current' : ''}`} aria-current={i === step ? 'step' : undefined}>
            <span className="lprog__dot" aria-hidden="true">
              {i < step ? <Icon name="check" size={12} /> : null}
            </span>
            <span className="lprog__label">
              {label}
              {i < step && <span className="sr-only"> (done)</span>}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

type HeadingRef = RefObject<HTMLHeadingElement | null>;

function StepHead({ headingRef, eyebrow, title, children }: { headingRef: HeadingRef; eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="lstep__head">
      <p className="lstep__eyebrow">{eyebrow}</p>
      <h1 className="lstep__title" ref={headingRef} tabIndex={-1}>
        {title}
      </h1>
      {children && <p className="lstep__lede">{children}</p>}
    </div>
  );
}

function Actions({ onBack, nextLabel = 'Continue', nextDisabled = false }: { onBack?: () => void; nextLabel?: string; nextDisabled?: boolean }) {
  return (
    <div className="lstep__actions">
      {onBack ? (
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          <Icon name="chevronLeft" size={16} />
          Back
        </button>
      ) : (
        <span />
      )}
      <button type="submit" className="btn btn--primary" disabled={nextDisabled}>
        {nextLabel}
        <Icon name="arrowRight" size={16} />
      </button>
    </div>
  );
}

/** A password-style field with an optional show/hide toggle. */
function SecretField({
  label,
  value,
  onChange,
  autoComplete,
  hint,
  error,
  long = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  hint?: string;
  error?: string;
  long?: boolean;
}) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="lfield">
      <label className="lfield__label" htmlFor={id}>
        {label}
      </label>
      <div className="lfield__secret">
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          spellCheck={false}
          autoCapitalize="off"
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          className={long ? 'lfield__input lfield__input--long' : 'lfield__input'}
        />
        <button type="button" className="lfield__toggle" onClick={() => setShown((s) => !s)} aria-pressed={shown} aria-controls={id} aria-label={`Show ${label.toLowerCase()}`}>
          <Icon name={shown ? 'eyeOff' : 'eye'} size={17} />
          <span aria-hidden="true">{shown ? 'Hide' : 'Show'}</span>
        </button>
      </div>
      {hint && (
        <p className="lfield__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="lfield__error" id={`${id}-err`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function AccountStep({
  headingRef,
  email,
  setEmail,
  password,
  setPassword,
  onNext,
}: {
  headingRef: HeadingRef;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  onNext: () => void;
}) {
  const id = useId();
  const [tried, setTried] = useState(false);
  const emailError = tried && !EMAIL_RE.test(email.trim()) ? 'Enter an email address, like name@example.com.' : undefined;
  const pwError = tried && password.length < MIN_PASSWORD ? `Use at least ${MIN_PASSWORD} characters.` : undefined;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (EMAIL_RE.test(email.trim()) && password.length >= MIN_PASSWORD) onNext();
  };
  return (
    <form className="lstep" onSubmit={submit} noValidate>
      <StepHead headingRef={headingRef} eyebrow="Welcome back" title="Sign in to Haven">
        Use the email and password for your Haven account.
      </StepHead>
      <div className="lfield">
        <label className="lfield__label" htmlFor={`${id}-email`}>
          Email
        </label>
        <input
          id={`${id}-email`}
          type="email"
          inputMode="email"
          autoComplete="username"
          className="lfield__input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!emailError || undefined}
          aria-describedby={emailError ? `${id}-email-err` : undefined}
        />
        {emailError && (
          <p className="lfield__error" id={`${id}-email-err`} role="alert">
            {emailError}
          </p>
        )}
      </div>
      <SecretField label="Password" value={password} onChange={setPassword} autoComplete="current-password" error={pwError} hint="Sample only: please don’t use a real password." />
      <Actions />
    </form>
  );
}

function SignatureStep({
  headingRef,
  swatch,
  setSwatch,
  onBack,
  onNext,
}: {
  headingRef: HeadingRef;
  swatch: SwatchId | null;
  setSwatch: (v: SwatchId) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const name = useId();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (swatch) onNext();
  };
  return (
    <form className="lstep" onSubmit={submit}>
      <StepHead headingRef={headingRef} eyebrow="Make it yours" title="Choose your signature colour">
        It tints your welcome. It’s a personal touch, not part of signing in.
      </StepHead>
      <fieldset className="lswatches">
        <legend className="sr-only">Signature colour</legend>
        {SIGNATURE_SWATCHES.map((s) => (
          <label key={s.id} className="lswatch" style={{ ['--swatch' as string]: s.hex, ['--swatch-ink' as string]: s.ink }}>
            <input type="radio" name={name} value={s.id} checked={swatch === s.id} onChange={() => setSwatch(s.id)} />
            <span className="lswatch__chip" aria-hidden="true">
              <Icon name="check" size={20} strokeWidth={2.4} />
            </span>
            <span className="lswatch__name">{s.name}</span>
          </label>
        ))}
      </fieldset>
      <Actions onBack={onBack} nextDisabled={!swatch} />
    </form>
  );
}

function PasskeyStep({
  headingRef,
  status,
  setStatus,
  onBack,
  onNext,
}: {
  headingRef: HeadingRef;
  status: 'idle' | 'checking' | 'done';
  setStatus: (s: 'idle' | 'checking' | 'done') => void;
  onBack: () => void;
  onNext: () => void;
}) {
  useEffect(() => {
    if (status !== 'checking') return;
    const t = window.setTimeout(() => setStatus('done'), 1400);
    return () => window.clearTimeout(t);
  }, [status, setStatus]);
  // Leaving mid-check never leaves it half-done.
  const statusRef = useRef(status);
  statusRef.current = status;
  useEffect(
    () => () => {
      if (statusRef.current === 'checking') setStatus('idle');
    },
    [setStatus],
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (status === 'done') onNext();
  };
  return (
    <form className="lstep" onSubmit={submit}>
      <StepHead headingRef={headingRef} eyebrow="Confirm it’s you" title="Use Face ID or a passkey">
        In the real app your device confirms it’s you with a passkey. Here it’s a demo.
      </StepHead>
      <div className={`lpasskey is-${status}`}>
        <button type="button" className="lpasskey__btn" onClick={() => setStatus('checking')} disabled={status !== 'idle'} aria-describedby="lpasskey-note">
          <span className="lpasskey__icon" aria-hidden="true">
            <Icon name={status === 'done' ? 'check' : 'faceScan'} size={30} />
          </span>
          <span className="lpasskey__text">
            <strong>{status === 'done' ? 'Confirmed (demo)' : status === 'checking' ? 'Checking… (demo)' : 'Simulate Face ID / passkey'}</strong>
            <span className="lpasskey__badge">Demo · no camera or biometrics used</span>
          </span>
        </button>
        <p className="sr-only" role="status" aria-live="polite">
          {status === 'checking' ? 'Simulating a passkey check.' : status === 'done' ? 'Demo passkey confirmed.' : ''}
        </p>
        <p className="lpasskey__note" id="lpasskey-note">
          <Icon name="key" size={15} />
          Nothing is scanned or stored. Haven’s real sign-in will use WebAuthn passkeys, which keep your face or fingerprint on your device.
        </p>
      </div>
      <Actions onBack={onBack} nextDisabled={status !== 'done'} />
    </form>
  );
}

function SentenceStep({
  headingRef,
  sentence,
  setSentence,
  onBack,
  onNext,
}: {
  headingRef: HeadingRef;
  sentence: string;
  setSentence: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [tried, setTried] = useState(false);
  const error = tried && sentence.trim().length < MIN_SENTENCE ? `Write at least ${MIN_SENTENCE} characters.` : undefined;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (sentence.trim().length >= MIN_SENTENCE) onNext();
  };
  return (
    <form className="lstep" onSubmit={submit} noValidate>
      <StepHead headingRef={headingRef} eyebrow="One last thing" title="Your personal sentence">
        A short passphrase only you would write. It stays hidden unless you choose to show it.
      </StepHead>
      <SecretField
        label="Personal sentence"
        value={sentence}
        onChange={setSentence}
        autoComplete="off"
        long
        error={error}
        hint="Sample only: it’s cleared when you finish and never saved."
      />
      <Actions onBack={onBack} nextLabel="Finish" />
    </form>
  );
}

function WelcomeStep({ headingRef, email, swatchName, onEnter }: { headingRef: HeadingRef; email: string; swatchName?: string; onEnter: () => void }) {
  const name = email.split('@')[0];
  return (
    <div className="lstep lwelcome">
      <span className="lwelcome__halo" aria-hidden="true">
        <BrandLogo variant="symbol" height={64} decorative />
      </span>
      <StepHead headingRef={headingRef} eyebrow="You’re in · sample" title={name ? `Welcome to Haven, ${name}` : 'Welcome to Haven'}>
        Creators belong here.
      </StepHead>
      <ul className="lwelcome__summary">
        <li>
          <Icon name="check" size={15} /> Email and password entered (sample, not checked)
        </li>
        <li>
          <Icon name="check" size={15} /> Passkey step simulated
        </li>
        {swatchName && (
          <li>
            <span className="lwelcome__sig" aria-hidden="true" /> Signature colour: {swatchName}
          </li>
        )}
      </ul>
      <button type="button" className="btn btn--primary btn--lg lwelcome__go" onClick={onEnter}>
        Go to your dashboard
        <Icon name="arrowRight" size={16} />
      </button>
    </div>
  );
}
