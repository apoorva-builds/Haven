import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../components/Brand';
import { Icon, type IconName } from '../components/Icon';
import { useTheme } from '../state/theme';
import '../styles/home.css';

/*
 * Haven's public homepage. Everything described here is labelled by what it
 * actually is today: "In the demo" (the workspace demo, sample data, runs in
 * the browser), "Planned" (designed, not built) or a standing commitment.
 * There are no prices, customer numbers, testimonials or certifications,
 * because none exist yet.
 */

const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#creator', label: 'Creator' },
  { href: '#personal', label: 'Personal' },
  { href: '#pricing', label: 'Pricing' },
];

export function HomePage() {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Haven · A calm home for your videos and every version of your work';
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="home">
      <a className="skip-link" href="#home-main">
        Skip to content
      </a>
      <HomeNav />
      <main id="home-main">
        <Hero />
        <WorkspacePreview />
        <CreatorFeatures />
        <PersonalSection />
        <Workflow />
        <Pricing />
        <Security />
        <Faq />
        <ClosingCta />
      </main>
      <HomeFooter />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ThemeButton() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" className="icon-btn hnav__theme" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
    </button>
  );
}

function HomeNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className={`hnav${scrolled ? ' is-scrolled' : ''}${open ? ' is-open' : ''}`}>
      <div className="hnav__inner">
        <Link to="/" className="hnav__brand" aria-label="Haven home">
          <BrandLogo variant="horizontal" height={30} decorative />
        </Link>
        <nav className="hnav__links" aria-label="Homepage">
          {NAV.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="hnav__actions">
          <ThemeButton />
          <Link to="/login" className="btn btn--ghost hnav__signin">
            Sign in
          </Link>
          <Link to="/signup" className="btn btn--primary hnav__start">
            Get started
          </Link>
          <button type="button" className="icon-btn hnav__menu" aria-expanded={open} aria-controls="hnav-panel" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close menu' : 'Open menu'}>
            <Icon name={open ? 'close' : 'menu'} />
          </button>
        </div>
      </div>
      <div id="hnav-panel" className="hnav__panel" hidden={!open}>
        <nav aria-label="Homepage, mobile">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} onClick={() => setOpen(false)}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="hnav__panel-actions">
          <Link to="/login" className="btn btn--ghost btn--lg">
            Sign in
          </Link>
          <Link to="/signup" className="btn btn--primary btn--lg">
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */

function Tag({ kind }: { kind: 'demo' | 'planned' | 'commitment' }) {
  const text = kind === 'demo' ? 'In the demo' : kind === 'planned' ? 'Planned' : 'Our commitment';
  return <span className={`htag htag--${kind}`}>{text}</span>;
}

function SectionHead({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="hsec__head">
      <p className="hsec__eyebrow">{eyebrow}</p>
      <h2 className="hsec__title" id={id}>
        {title}
      </h2>
      {children && <p className="hsec__lede">{children}</p>}
    </div>
  );
}

function Hero() {
  return (
    <section className="hhero" aria-labelledby="hhero-title">
      <div className="hhero__copy">
        <p className="hhero__badge">
          <span className="hhero__badge-dot" aria-hidden="true" />
          Early preview · not yet available to sign up
        </p>
        <h1 className="hhero__title" id="hhero-title">
          One idea.
          <br />
          Every version.
        </h1>
        <p className="hhero__lede">A calm workspace for your media, ideas and every version of your work.</p>
        <p className="hhero__sub">
          <strong>Haven Creator</strong> organises your footage, drafts, captions, accounts and calendar in one place. <strong>Haven Personal</strong> is a private home
          for the long videos you want to keep.
        </p>
        <div className="hhero__ctas">
          <Link to="/signup" className="btn btn--primary btn--lg">
            Get started
            <Icon name="arrowRight" size={16} />
          </Link>
          <Link to="/app" className="btn btn--ghost btn--lg">
            Explore the workspace demo
          </Link>
        </div>
        <p className="hhero__note">The demo uses sample data and runs in your browser. Nothing is uploaded or stored online.</p>
      </div>

      <div className="hhero__art" aria-hidden="true">
        <figure className="hver hver--wide">
          <img src="/demo-media/morning-wide.jpg" alt="" width={640} height={360} />
          <figcaption>
            <span>Original</span> Long cut · 16:9
          </figcaption>
        </figure>
        <figure className="hver hver--tall hver--a">
          <img src="/demo-media/morning-vertical.jpg" alt="" width={270} height={480} />
          <figcaption>
            <span>Reel</span> 9:16
          </figcaption>
        </figure>
        <figure className="hver hver--tall hver--b">
          <img src="/demo-media/quiet-places-vertical.jpg" alt="" width={270} height={480} />
          <figcaption>
            <span>Short</span> 9:16
          </figcaption>
        </figure>
        <p className="hhero__tagline">Creators belong here.</p>
      </div>
    </section>
  );
}

function WorkspacePreview() {
  return (
    <section className="hsec hpreview" aria-labelledby="hpreview-title">
      <SectionHead id="hpreview-title" eyebrow="The creator workspace" title="Your whole practice, on one calm page">
        This is the actual Haven workspace demo: Today, with what’s next, what you’ve posted and a memory from a year ago. Explore every page with sample data.
      </SectionHead>
      <div className="hpreview__stage">
        <figure className="hframe hframe--desktop">
          <div className="hframe__bar" aria-hidden="true">
            <span />
            <span />
            <span />
            <p>haven / today</p>
          </div>
          <img className="theme-img--light" src="/marketing/workspace-desktop-light.webp" width={1440} height={900} loading="lazy" decoding="async" alt="The Haven workspace demo’s Today page: a greeting, the next task with its idea, a memory from a year ago and a week of posts." />
          <img className="theme-img--dark" src="/marketing/workspace-desktop-dark.webp" width={1440} height={900} loading="lazy" decoding="async" alt="" aria-hidden="true" />
        </figure>
        <figure className="hframe hframe--phone" aria-hidden="true">
          <img className="theme-img--light" src="/marketing/workspace-phone-light.webp" width={412} height={839} loading="lazy" decoding="async" alt="" />
          <img className="theme-img--dark" src="/marketing/workspace-phone-dark.webp" width={412} height={839} loading="lazy" decoding="async" alt="" />
        </figure>
      </div>
      <div className="hpreview__foot">
        <Link to="/app" className="btn btn--primary">
          Open the workspace demo
          <Icon name="arrowRight" size={16} />
        </Link>
        <p>Sample data only. Changes reset when you reload.</p>
      </div>
    </section>
  );
}

const CREATOR: { icon: IconName; title: string; body: string; to: string; link: string }[] = [
  { icon: 'library', title: 'Raw footage and finished videos', body: 'Keep source clips, B-roll and final exports together in a media library, so nothing lives in a stray folder.', to: '/library', link: 'Raw Library' },
  { icon: 'film', title: 'Drafts, review and final cut', body: 'Each project keeps its drafts in order. Leave time-stamped notes in a Review Booklet and mark the final when it’s ready.', to: '/studio', link: 'Video Studio' },
  { icon: 'layers', title: 'Every platform version', body: 'One idea becomes a Reel, a Short and a long cut, each with its own caption, cover and status, all linked to the original idea.', to: '/ideas', link: 'Ideas' },
  { icon: 'accounts', title: 'Many accounts, one view', body: 'See what each account has posted and planned across Instagram, TikTok and YouTube. Haven never asks for their passwords.', to: '/gallery', link: 'Creation Gallery' },
  { icon: 'calendar', title: 'A creative calendar', body: 'Plan by day, week or month, filter by account or campaign, and open any day to see everything that went out.', to: '/calendar', link: 'Calendar' },
  { icon: 'user', title: 'Teams, when you want them', body: 'Invite an editor or a manager and choose which Spaces and accounts each person can see. An optional extra, not a requirement.', to: '/team', link: 'Team & access' },
];

function CreatorFeatures() {
  return (
    <section className="hsec" id="features" aria-labelledby="hfeat-title">
      <div id="creator" className="hanchor" />
      <SectionHead id="hfeat-title" eyebrow="Haven Creator" title="Made for the way creators actually work">
        From the first clip to the last caption, every piece of a video stays connected. Each of these is in the workspace demo today, with sample data.
      </SectionHead>
      <ul className="hcards">
        {CREATOR.map((c) => (
          <li key={c.title} className="hcard">
            <span className="hcard__icon" aria-hidden="true">
              <Icon name={c.icon} size={22} />
            </span>
            <h3 className="hcard__title">{c.title}</h3>
            <p className="hcard__body">{c.body}</p>
            <div className="hcard__foot">
              <Tag kind="demo" />
              <Link to={c.to} className="hcard__link">
                Open {c.link}
                <Icon name="arrowRight" size={14} />
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const FILMS = [
  { title: 'Our wedding film', meta: '42 min · full length', hue: 'a' },
  { title: 'Dad’s 70th, the whole evening', meta: '1 h 18 min', hue: 'b' },
  { title: 'First steps, edited', meta: '6 min', hue: 'c' },
];

function PersonalSection() {
  return (
    <section className="hsec hpersonal" id="personal" aria-labelledby="hpersonal-title">
      <div className="hpersonal__copy">
        <p className="hsec__eyebrow">
          Haven Personal <Tag kind="planned" />
        </p>
        <h2 className="hsec__title" id="hpersonal-title">
          A private home for the long films that matter
        </h2>
        <p className="hsec__lede">
          Wedding films, family edits, favourite videos and important recordings deserve better than a full phone or a forgotten drive. Haven Personal is a separate,
          private space designed around long-form video, not photo collections.
        </p>
        <ul className="hlist">
          <li>
            <Icon name="film" size={18} /> Long videos kept whole, at the quality you upload
          </li>
          <li>
            <Icon name="bookmark" size={18} /> Titles, dates and notes, so you can find a moment years later
          </li>
          <li>
            <Icon name="shield" size={18} /> Private by default, kept apart from any creator work
          </li>
          <li>
            <Icon name="heart" size={18} /> Share a single film with family when you choose
          </li>
        </ul>
        <p className="hfine">Haven Personal is being designed and isn’t available yet. These are planned features.</p>
      </div>
      <div className="hpersonal__art" aria-label="Concept preview of a Haven Personal library" role="img">
        <p className="hpersonal__concept">Concept preview</p>
        <ul className="hfilms" aria-hidden="true">
          {FILMS.map((f) => (
            <li key={f.title} className={`hfilm hfilm--${f.hue}`}>
              <span className="hfilm__thumb">
                <Icon name="play" size={16} />
              </span>
              <span className="hfilm__text">
                <strong>{f.title}</strong>
                <span>{f.meta}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Workflow() {
  const steps: { icon: IconName; title: string; body: string }[] = [
    { icon: 'upload', title: 'Keep the originals', body: 'Raw footage and finished films live in your library, in one place instead of scattered across drives and phones.' },
    { icon: 'layers', title: 'Shape every version', body: 'Drafts, review notes, captions and platform cuts stay attached to the idea and the files they came from.' },
    { icon: 'check', title: 'Post it yourself', body: 'You publish on each platform as you do today. Mark it posted and add the link; Haven never posts for you.' },
  ];
  return (
    <section className="hsec hflow" aria-labelledby="hflow-title">
      <SectionHead id="hflow-title" eyebrow="Storage meets workflow" title="Where your files and your work finally meet">
        Files usually live in one place and plans in another. Haven keeps them together, so every version knows where it came from and where it went.
      </SectionHead>
      <ol className="hsteps">
        {steps.map((s, i) => (
          <li key={s.title} className="hstep">
            <span className="hstep__num" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="hstep__icon" aria-hidden="true">
              <Icon name={s.icon} size={20} />
            </span>
            <h3 className="hstep__title">{s.title}</h3>
            <p className="hstep__body">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Pricing() {
  const plans = [
    {
      id: 'creator',
      name: 'Haven Creator',
      for: 'For creators and small teams',
      items: ['Media library for raw footage and finished videos', 'Ideas, drafts, captions and platform versions', 'Multiple social accounts and a creative calendar', 'Team members and access control as an add-on'],
    },
    {
      id: 'personal',
      name: 'Haven Personal',
      for: 'For your family’s long films',
      items: ['Private space for long-form videos', 'Titles, dates and notes for every film', 'Kept separate from creator work', 'Share a single film when you choose'],
    },
  ];
  return (
    <section className="hsec" id="pricing" aria-labelledby="hpricing-title">
      <SectionHead id="hpricing-title" eyebrow="Pricing" title="Two plans, each with one clear purpose">
        Prices aren’t set yet. What each plan is planned to include is below; we’ll publish prices before anyone is asked to pay.
      </SectionHead>
      <ul className="hplans">
        {plans.map((p) => (
          <li key={p.id} className={`hplan hplan--${p.id}`}>
            <div className="hplan__head">
              <h3 className="hplan__name">{p.name}</h3>
              <p className="hplan__for">{p.for}</p>
            </div>
            <p className="hplan__price">
              <span>Price to be announced</span>
              <Tag kind="planned" />
            </p>
            <ul className="hplan__items">
              {p.items.map((it) => (
                <li key={it}>
                  <Icon name="check" size={16} /> {it}
                </li>
              ))}
            </ul>
            <Link to={`/signup?plan=${p.id}`} className={`btn btn--lg ${p.id === 'creator' ? 'btn--primary' : 'btn--ghost'}`} aria-label={`Preview sign-up for ${p.name}`}>
              Preview sign-up
            </Link>
          </li>
        ))}
      </ul>
      <p className="hfine hfine--center">Payments aren’t active. No card details are requested anywhere in this preview.</p>
    </section>
  );
}

function Security() {
  const items: { icon: IconName; title: string; body: string; kind: 'planned' | 'commitment' }[] = [
    { icon: 'key', title: 'Passwords and passkeys', body: 'Secure password sign-in, plus passkeys (WebAuthn) so your face or fingerprint never leaves your device.', kind: 'planned' },
    { icon: 'shield', title: 'Encrypted in transit and at rest', body: 'Your files and details encrypted on the way to Haven and while they’re stored.', kind: 'planned' },
    { icon: 'user', title: 'Private by default, shared on purpose', body: 'Spaces and roles decide who sees what. Creator work and Personal films stay separate.', kind: 'planned' },
    { icon: 'accounts', title: 'Never your social passwords', body: 'Haven will never ask for the passwords to your social accounts. A handle only identifies an account.', kind: 'commitment' },
    { icon: 'check', title: 'You publish, not Haven', body: 'Haven doesn’t post on your behalf. Every post goes out when you send it yourself.', kind: 'commitment' },
  ];
  return (
    <section className="hsec hsecurity" aria-labelledby="hsecurity-title">
      <SectionHead id="hsecurity-title" eyebrow="Security and privacy" title="Built to be trusted with what you can’t replace">
        Haven isn’t live yet, so these are the protections we’re building toward, not ones you can rely on today. The current preview keeps everything in your
        browser.
      </SectionHead>
      <ul className="hsafe">
        {items.map((it) => (
          <li key={it.title} className="hsafe__item">
            <span className="hsafe__icon" aria-hidden="true">
              <Icon name={it.icon} size={20} />
            </span>
            <div>
              <h3 className="hsafe__title">
                {it.title} <Tag kind={it.kind} />
              </h3>
              <p className="hsafe__body">{it.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const FAQ: { q: string; a: string }[] = [
  { q: 'Can I use Haven today?', a: 'Not yet. Haven is in an early preview. You can explore the creator workspace demo with sample data and try the sample sign-in and sign-up screens, but there are no real accounts yet.' },
  { q: 'Is the workspace demo real?', a: 'It’s the real interface running on sample data. Everything happens in your browser: files you choose stay in that tab, nothing is uploaded, and changes reset when you reload.' },
  { q: 'What’s the difference between Creator and Personal?', a: 'Haven Creator is a workspace for making content: footage, drafts, captions, accounts, versions and a calendar. Haven Personal is a separate, private space for keeping long videos like wedding films and family edits. They’re planned as separate plans.' },
  { q: 'Will Haven post to my social accounts?', a: 'No. You post on each platform yourself. In Haven you mark a version as posted and add its link, so your calendar and gallery stay accurate.' },
  { q: 'Does Haven need my social media passwords?', a: 'No, and it never will. Each person signs in to Haven as themselves; an account handle only identifies which account a post is for.' },
  { q: 'How much will it cost?', a: 'Prices haven’t been set. We’ll publish them before anyone is asked to pay, and no payment details are collected in this preview.' },
  { q: 'Can my team work with me?', a: 'Yes, as an optional extra in Haven Creator. You can preview how invitations and per-account access work in the demo; real accounts and server-side access control are planned.' },
];

function Faq() {
  return (
    <section className="hsec hfaq" aria-labelledby="hfaq-title">
      <SectionHead id="hfaq-title" eyebrow="Questions" title="Frequently asked" />
      <div className="hfaq__list">
        {FAQ.map((f) => (
          <details key={f.q} className="hfaq__item">
            <summary>
              {f.q}
              <Icon name="plus" size={18} />
            </summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="hclose" aria-labelledby="hclose-title">
      <BrandLogo variant="symbol" height={56} decorative />
      <h2 className="hclose__title" id="hclose-title">
        Creators belong here.
      </h2>
      <p>Walk through the workspace now, or preview what signing up will look like.</p>
      <div className="hhero__ctas hclose__ctas">
        <Link to="/signup" className="btn btn--primary btn--lg">
          Get started
        </Link>
        <Link to="/app" className="btn btn--ghost btn--lg">
          Explore the workspace demo
        </Link>
      </div>
    </section>
  );
}

function HomeFooter() {
  return (
    <footer className="hfoot">
      <div className="hfoot__inner">
        <div className="hfoot__brand">
          <BrandLogo variant="horizontal" height={28} />
          <p>A calm workspace for your media, ideas and every version of your work.</p>
        </div>
        <nav className="hfoot__col" aria-labelledby="hfoot-product">
          <h2 id="hfoot-product">Product</h2>
          <ul>
            <li>
              <a href="#features">Features</a>
            </li>
            <li>
              <a href="#creator">Haven Creator</a>
            </li>
            <li>
              <a href="#personal">Haven Personal</a>
            </li>
            <li>
              <a href="#pricing">Pricing</a>
            </li>
          </ul>
        </nav>
        <nav className="hfoot__col" aria-labelledby="hfoot-preview">
          <h2 id="hfoot-preview">Preview</h2>
          <ul>
            <li>
              <Link to="/app">Workspace demo</Link>
            </li>
            <li>
              <Link to="/login">Sample sign-in</Link>
            </li>
            <li>
              <Link to="/signup">Sample sign-up</Link>
            </li>
          </ul>
        </nav>
        <div className="hfoot__col">
          <h2>Legal</h2>
          <ul>
            <li>
              Privacy policy <span className="hfoot__soon">Before launch</span>
            </li>
            <li>
              Terms of service <span className="hfoot__soon">Before launch</span>
            </li>
            <li>
              Cookie policy <span className="hfoot__soon">Before launch</span>
            </li>
          </ul>
        </div>
      </div>
      <p className="hfoot__base">© {new Date().getFullYear()} Haven · Early preview. Features marked planned aren’t available yet.</p>
    </footer>
  );
}
