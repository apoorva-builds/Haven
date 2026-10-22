import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BrandLogo } from '../components/Brand';
import { Icon } from '../components/Icon';
import '../styles/login.css';
import '../styles/signup.css';

/*
 * Sign-up preview. UI only: nothing is sent, stored or charged. It shows
 * the plan choice and the first details Haven will ask for, then says
 * plainly that accounts aren't open yet.
 */

type Plan = 'creator' | 'personal';
const PLANS: { id: Plan; name: string; blurb: string }[] = [
  { id: 'creator', name: 'Haven Creator', blurb: 'A workspace for footage, drafts, captions, accounts and your calendar.' },
  { id: 'personal', name: 'Haven Personal', blurb: 'A private home for wedding films, family edits and other long videos.' },
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignupPage() {
  const [params] = useSearchParams();
  const initial = params.get('plan');
  const [plan, setPlan] = useState<Plan>(initial === 'personal' ? 'personal' : 'creator');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [tried, setTried] = useState(false);
  const [done, setDone] = useState(false);
  const id = useId();
  const doneRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  const nameError = tried && !name.trim() ? 'Enter your name.' : undefined;
  const emailError = tried && !EMAIL_RE.test(email.trim()) ? 'Enter an email address, like name@example.com.' : undefined;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (name.trim() && EMAIL_RE.test(email.trim())) {
      setDone(true);
      // Nothing is kept once the preview is complete.
      setName('');
      setEmail('');
    }
  };
  const chosen = PLANS.find((p) => p.id === plan)!;

  return (
    <div className="login">
      <aside className="login__brand" aria-hidden="true">
        <BrandLogo variant="symbol" height={96} className="login__mark" decorative />
        <p className="login__tagline">Creators belong here.</p>
      </aside>

      <main className="login__main">
        <header className="login__top">
          <Link to="/" aria-label="Haven home">
            <BrandLogo variant="horizontal" height={34} decorative />
          </Link>
          <span className="login__demo">
            <span className="login__demo-dot" aria-hidden="true" />
            Sign-up preview · UI only
          </span>
        </header>

        <div className="login__card">
          {done ? (
            <div className="lstep lwelcome">
              <span className="lwelcome__halo" aria-hidden="true">
                <BrandLogo variant="symbol" height={64} decorative />
              </span>
              <div className="lstep__head">
                <p className="lstep__eyebrow">Preview complete</p>
                <h1 className="lstep__title" ref={doneRef} tabIndex={-1}>
                  That’s the start of {chosen.name}
                </h1>
                <p className="lstep__lede">
                  Accounts aren’t open yet, so nothing was created or sent and your details weren’t saved. When sign-up opens, this is where you’ll set a password and
                  a passkey.
                </p>
              </div>
              <div className="signup__done-actions">
                <Link to="/app" className="btn btn--primary btn--lg">
                  Explore the workspace demo
                  <Icon name="arrowRight" size={16} />
                </Link>
                <Link to="/" className="btn btn--ghost btn--lg">
                  Back to the homepage
                </Link>
              </div>
            </div>
          ) : (
            <form className="lstep" onSubmit={submit} noValidate>
              <div className="lstep__head">
                <p className="lstep__eyebrow">Get started</p>
                <h1 className="lstep__title">Create your Haven</h1>
                <p className="lstep__lede">A preview of sign-up. Choose a plan and tell us who you are.</p>
              </div>

              <fieldset className="signup__plans">
                <legend className="lfield__label">Plan</legend>
                {PLANS.map((p) => (
                  <label key={p.id} className="signup__plan">
                    <input type="radio" name={`${id}-plan`} value={p.id} checked={plan === p.id} onChange={() => setPlan(p.id)} />
                    <span className="signup__plan-text">
                      <strong>{p.name}</strong>
                      <span>{p.blurb}</span>
                      <span className="signup__plan-price">Price to be announced · planned</span>
                    </span>
                  </label>
                ))}
              </fieldset>

              <div className="lfield">
                <label className="lfield__label" htmlFor={`${id}-name`}>
                  Your name
                </label>
                <input
                  id={`${id}-name`}
                  className="lfield__input"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={!!nameError || undefined}
                  aria-describedby={nameError ? `${id}-name-err` : undefined}
                />
                {nameError && (
                  <p className="lfield__error" id={`${id}-name-err`} role="alert">
                    {nameError}
                  </p>
                )}
              </div>
              <div className="lfield">
                <label className="lfield__label" htmlFor={`${id}-email`}>
                  Email
                </label>
                <input
                  id={`${id}-email`}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
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

              <div className="lstep__actions">
                <Link to="/login" className="signup__signin">
                  Try the sample sign-in instead
                </Link>
                <button type="submit" className="btn btn--primary">
                  Continue
                  <Icon name="arrowRight" size={16} />
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="login__fineprint">
          This is a design preview. Nothing you enter is sent or saved, no account is created and no payment is taken. Haven’s real sign-up will use a secure
          password and passkeys (WebAuthn).
        </p>
      </main>
    </div>
  );
}
