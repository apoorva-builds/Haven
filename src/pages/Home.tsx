import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../components/Brand';
import { Icon, type IconName } from '../components/Icon';
import '../styles/home.css';

/*
 * Haven's public homepage. Light-first: it opens in ivory whatever the
 * device setting, and its own toggle offers the dark edition (remembered in
 * this browser only; it doesn't touch anyone's workspace appearance).
 *
 * Everything is labelled by what it is today: "In the demo" (the workspace
 * demo, sample data, runs in the browser), "Planned" (designed, not built)
 * or a standing commitment. There are no prices, customer numbers,
 * testimonials or certifications, because none exist yet.
 */

type HomeTheme = 'light' | 'dark';
const THEME_KEY = 'haven.home.theme';

function useHomeTheme(): [HomeTheme, () => void] {
  const [theme, setTheme] = useState<HomeTheme>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* storage blocked: the choice lasts for this visit */
      }
      return next;
    });
  }, []);
  return [theme, toggle];
}

/** Sections fade in once as they reach the viewport (not with reduced motion). */
function useReveal(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const targets = [...el.querySelectorAll<HTMLElement>('[data-reveal]')];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    // Only content still below the fold waits to be revealed.
    for (const t of targets) {
      if (t.getBoundingClientRect().top > window.innerHeight) {
        t.classList.add('will-reveal');
        io.observe(t);
      }
    }
    return () => io.disconnect();
  }, [root]);
}

const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#creator', label: 'Creator' },
  { href: '#personal', label: 'Personal' },
  { href: '#pricing', label: 'Pricing' },
];

export function HomePage() {
  const [theme, toggleTheme] = useHomeTheme();
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Haven · One idea. Every version.';
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div ref={ref} className={`home${theme === 'dark' ? ' home--dark' : ''}`}>
      <a className="skip-link" href="#home-main">
        Skip to content
      </a>
      <HomeNav theme={theme} onToggleTheme={toggleTheme} />
      <main id="home-main">
        <Hero theme={theme} />
        <CreatorSection />
        <VersionsBand />
        <PersonalSection />
        <StudioSection />
        <Pricing />
        <Trust />
        <Faq />
        <Finale />
      </main>
      <HomeFooter />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function HomeNav({ theme, onToggleTheme }: { theme: HomeTheme; onToggleTheme: () => void }) {
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
          <BrandLogo variant="horizontal" height={28} decorative />
        </Link>
        <nav className="hnav__links" aria-label="Homepage">
          {NAV.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="hnav__actions">
          <button type="button" className="hnav__theme" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
          </button>
          <Link to="/login" className="hbtn hbtn--quiet hnav__signin">
            Sign in
          </Link>
          <Link to="/signup" className="hbtn hbtn--primary hnav__start">
            Get started
          </Link>
          <button type="button" className="hnav__menu" aria-expanded={open} aria-controls="hnav-panel" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close menu' : 'Open menu'}>
            <Icon name={open ? 'close' : 'menu'} />
          </button>
        </div>
      </div>
      <div id="hnav-panel" className="hnav__panel" hidden={!open}>
        <nav aria-label="Homepage, mobile">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} onClick={() => setOpen(false)}>
              {n.label}
              <Icon name="chevronRight" size={16} />
            </a>
          ))}
        </nav>
        <div className="hnav__panel-actions">
          <Link to="/login" className="hbtn hbtn--outline hbtn--lg">
            Sign in
          </Link>
          <Link to="/signup" className="hbtn hbtn--primary hbtn--lg">
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

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="heyebrow">{children}</p>;
}

/* Hero and product showcase ------------------------------------------------ */

const VIEWS = [
  { id: 'today', label: 'Today', caption: 'Today: what’s next, what you’ve posted this week and a memory from a year ago.', alt: 'The Haven workspace Today page with the next task, a week of posts and a memory from a year ago.' },
  { id: 'library', label: 'Library', caption: 'Raw Library: originals kept safe, with storage, duplicates and every source file in one place.', alt: 'The Haven Raw Library with storage use and source files.' },
  { id: 'calendar', label: 'Calendar', caption: 'Calendar: everything posted and planned across your Spaces and accounts, by day, week or month.', alt: 'The Haven Calendar showing a month of posted and planned content.' },
  { id: 'accounts', label: 'Accounts', caption: 'Creation Gallery: every account in one view, filtered by account and status.', alt: 'The Haven Creation Gallery with all accounts and upcoming posts.' },
] as const;
type ViewId = (typeof VIEWS)[number]['id'];

function Hero({ theme }: { theme: HomeTheme }) {
  return (
    <section className="hhero" aria-labelledby="hhero-title">
      <div className="hhero__grid" aria-hidden="true" />
      <div className="hhero__copy">
        <Eyebrow>Haven · Early preview</Eyebrow>
        <h1 className="hhero__title" id="hhero-title">
          One idea.
          <br />
          <span className="hhero__title-em">Every version.</span>
        </h1>
        <p className="hhero__lede">A calm workspace for your media, ideas and every version of your work, and a private home for the films you’ll keep for life.</p>
        <div className="hhero__ctas">
          <Link to="/signup" className="hbtn hbtn--primary hbtn--lg">
            Get started
            <Icon name="arrowRight" size={16} />
          </Link>
          <Link to="/app" className="hbtn hbtn--outline hbtn--lg">
            Explore the workspace demo
          </Link>
        </div>
        <ul className="hhero__facts" aria-label="About this preview">
          <li>Sample data</li>
          <li>Runs in your browser</li>
          <li>Nothing uploaded or stored</li>
        </ul>
      </div>
      <Showcase theme={theme} />
    </section>
  );
}

function Showcase({ theme }: { theme: HomeTheme }) {
  const [view, setView] = useState<ViewId>('today');
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = VIEWS.find((v) => v.id === view)!;

  const onKey = (e: ReactKeyboardEvent, i: number) => {
    const n = VIEWS.length;
    const to = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    setView(VIEWS[to].id);
    tabs.current[to]?.focus();
  };

  return (
    <div className="hshow" id="product">
      <div className="hshow__tabs" role="tablist" aria-label="Workspace views">
        {VIEWS.map((v, i) => (
          <button
            key={v.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`hshow-tab-${v.id}`}
            aria-selected={view === v.id}
            aria-controls="hshow-panel"
            tabIndex={view === v.id ? 0 : -1}
            className="hshow__tab"
            onClick={() => setView(v.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {v.label}
          </button>
        ))}
      </div>
      <figure className="hshow__frame" id="hshow-panel" role="tabpanel" aria-labelledby={`hshow-tab-${view}`}>
        <div className="hshow__chrome" aria-hidden="true">
          <span />
          <span />
          <span />
          <p>haven · {current.label.toLowerCase()}</p>
        </div>
        <div className="hshow__screen">
          {VIEWS.map((v) => (
            <img
              key={`${v.id}-${theme}`}
              src={`/marketing/showcase-${v.id}-${theme}.webp`}
              width={2560}
              height={1600}
              alt={v.id === view ? v.alt : ''}
              aria-hidden={v.id === view ? undefined : true}
              className={v.id === view ? 'is-active' : ''}
              loading={v.id === 'today' ? 'eager' : 'lazy'}
              decoding="async"
            />
          ))}
        </div>
      </figure>
      <p className="hshow__caption" aria-live="polite">
        {current.caption} <span>The real workspace demo, with sample data.</span>
      </p>
    </div>
  );
}

/* Creator ------------------------------------------------------------------ */

const CREATOR: { icon: IconName; title: string; body: string; to: string; link: string }[] = [
  { icon: 'library', title: 'Media library', body: 'Raw footage, B-roll and finished exports kept together, with storage you can see and duplicates flagged.', to: '/library', link: 'Raw Library' },
  { icon: 'accounts', title: 'Many accounts, one view', body: 'What each Instagram, TikTok and YouTube account has posted and planned. Haven never asks for their passwords.', to: '/gallery', link: 'Creation Gallery' },
  { icon: 'film', title: 'Drafts and review', body: 'Drafts in order, time-stamped notes in a Review Booklet and a clear final cut for every project.', to: '/studio', link: 'Video Studio' },
  { icon: 'layers', title: 'Platform versions', body: 'One idea becomes a Reel, a Short and a long cut, each with its own caption, cover and status.', to: '/ideas', link: 'Ideas' },
  { icon: 'calendar', title: 'Publishing calendar', body: 'Plan by day, week or month. You post on each platform yourself, then mark it posted and add the link.', to: '/calendar', link: 'Calendar' },
  { icon: 'user', title: 'Teams, when you want them', body: 'Invite an editor or a manager and choose which Spaces and accounts each person can see.', to: '/team', link: 'Team & access' },
];

function CreatorSection() {
  return (
    <section className="hsec hcreator" id="features" aria-labelledby="hcreator-title">
      <span id="creator" className="hanchor" aria-hidden="true" />
      <div className="hsplit" data-reveal>
        <div>
          <Eyebrow>Haven Creator</Eyebrow>
          <h2 className="htitle" id="hcreator-title">
            Everything a video needs, from first clip to final post.
          </h2>
        </div>
        <div className="hsplit__aside">
          <p className="hlede">
            A professional workspace for creators who publish across many accounts. Footage, drafts, captions, versions and the calendar stay connected, so nothing
            gets lost between apps.
          </p>
          <Link to="/app" className="hlink">
            Open the workspace demo
            <Icon name="arrowRight" size={15} />
          </Link>
        </div>
      </div>
      <ul className="hgrid" data-reveal>
        {CREATOR.map((c, i) => (
          <li key={c.title} className="hgrid__item">
            <div className="hgrid__top">
              <span className="hgrid__icon" aria-hidden="true">
                <Icon name={c.icon} size={20} />
              </span>
              <span className="hgrid__num" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
            </div>
            <h3 className="hgrid__title">{c.title}</h3>
            <p className="hgrid__body">{c.body}</p>
            <div className="hgrid__foot">
              <Tag kind="demo" />
              <Link to={c.to} className="hlink hlink--sm" aria-label={`Open ${c.link}`}>
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

function VersionsBand() {
  return (
    <section className="hsec hversions" aria-labelledby="hversions-title">
      <div className="hversions__copy" data-reveal>
        <Eyebrow>Versions</Eyebrow>
        <h2 className="htitle htitle--md" id="hversions-title">
          One idea. Every platform.
        </h2>
        <p className="hlede">
          Start from the original and shape each cut for where it’s going. Every version keeps its own caption, cover and status, and always knows which idea and
          files it came from.
        </p>
      </div>
      <ol className="hversions__row" data-reveal aria-label="One idea, three versions (sample)">
        <li className="hver hver--wide">
          <div className="hver__media">
            <img src="/demo-media/morning-wide.jpg" alt="A sunlit desk with a plant and a blue mug, the original long cut." width={640} height={360} loading="lazy" />
          </div>
          <p>
            <strong>Original</strong> YouTube · 16:9 · long cut
          </p>
        </li>
        <li className="hver">
          <div className="hver__media">
            <img src="/demo-media/morning-vertical.jpg" alt="The same desk scene, framed vertically for a Reel." width={270} height={480} loading="lazy" />
          </div>
          <p>
            <strong>Reel</strong> 9:16
          </p>
        </li>
        <li className="hver">
          <div className="hver__media">
            <img src="/demo-media/quiet-places-vertical.jpg" alt="A quiet reading corner, framed vertically for a Short." width={270} height={480} loading="lazy" />
          </div>
          <p>
            <strong>Short</strong> 9:16
          </p>
        </li>
      </ol>
    </section>
  );
}

/* Personal ----------------------------------------------------------------- */

const FILMS = [
  { year: '2019', title: 'Our wedding film', meta: 'Full ceremony and evening', length: '42 min' },
  { year: '2021', title: 'The summer house, all of it', meta: 'Family edit', length: '54 min' },
  { year: '2023', title: 'Dad’s 70th, the whole evening', meta: 'Recorded live', length: '1 h 18 min' },
  { year: '2024', title: 'First steps, edited', meta: 'Favourite', length: '6 min' },
];

function PersonalSection() {
  return (
    <section className="hpersonal" id="personal" aria-labelledby="hpersonal-title">
      <div className="hpersonal__inner">
        <div className="hpersonal__copy" data-reveal>
          <Eyebrow>
            Haven Personal <Tag kind="planned" />
          </Eyebrow>
          <h2 className="htitle" id="hpersonal-title">
            For the films you’ll still want to watch in fifty years.
          </h2>
          <p className="hlede">
            Wedding films, family edits, favourite videos and important recordings deserve more than a full phone or a forgotten drive. Haven Personal is a separate,
            private home made for long-form video.
          </p>
          <ul className="hchecks">
            <li>
              <Icon name="film" size={18} /> Long videos kept whole, at the quality you upload
            </li>
            <li>
              <Icon name="bookmark" size={18} /> Titles, dates and notes, so a moment is easy to find years later
            </li>
            <li>
              <Icon name="shield" size={18} /> Private by default, kept apart from any creator work
            </li>
            <li>
              <Icon name="heart" size={18} /> Share a single film with family, only when you choose
            </li>
          </ul>
          <p className="hfine">Haven Personal is being designed and isn’t available yet. It’s for long-form video, not photo libraries.</p>
        </div>
        <figure className="harchive" data-reveal aria-labelledby="harchive-cap">
          <figcaption id="harchive-cap" className="harchive__cap">
            <span>Your films</span>
            <span className="harchive__concept">Concept · sample titles</span>
          </figcaption>
          <ol className="harchive__list">
            {FILMS.map((f) => (
              <li key={f.title} className="harchive__row">
                <span className="harchive__year">{f.year}</span>
                <span className="harchive__title">
                  <strong>{f.title}</strong>
                  <span>{f.meta}</span>
                </span>
                <span className="harchive__len">{f.length}</span>
                <span className="harchive__play" aria-hidden="true">
                  <Icon name="play" size={12} />
                </span>
              </li>
            ))}
          </ol>
        </figure>
      </div>
    </section>
  );
}

/* Studio: the one dark, cinematic section ------------------------------------ */

function StudioSection() {
  const points: { title: string; body: string }[] = [
    { title: 'Drafts in order', body: 'Original footage, every draft and the final cut, side by side in one project.' },
    { title: 'A Review Booklet', body: 'Time-stamped notes by chapter, so everyone knows what’s done and what needs eyes.' },
    { title: 'A clear finish', body: 'Upload the final video and work through a publishing checklist before it goes out.' },
  ];
  const steps: { title: string; body: string }[] = [
    { title: 'Keep the originals', body: 'Raw footage and finished films live in your library, not scattered across drives.' },
    { title: 'Shape every version', body: 'Drafts, notes, captions and platform cuts stay attached to the idea.' },
    { title: 'Post it yourself', body: 'You publish on each platform; Haven never posts for you. Mark it posted and add the link.' },
  ];
  return (
    <section className="hcine" aria-labelledby="hcine-title">
      <div className="hcine__inner">
        <div className="hcine__head" data-reveal>
          <Eyebrow>Video Studio</Eyebrow>
          <h2 className="htitle" id="hcine-title">
            Review every cut like it’s the premiere.
          </h2>
          <p className="hlede">Long-form video gets its own room. Watch a draft, leave a note at the exact second, and see at a glance what’s ready.</p>
        </div>
        <figure className="hcine__frame" data-reveal>
          <img
            src="/marketing/showcase-studio-dark.webp"
            width={2560}
            height={1600}
            loading="lazy"
            decoding="async"
            alt="The Haven Video Studio: a long cut playing at 7:20 beside its Review Booklet, with notes by chapter and review progress."
          />
        </figure>
        <ul className="hcine__points" data-reveal>
          {points.map((p) => (
            <li key={p.title}>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </li>
          ))}
        </ul>
        <div className="hcine__flow" data-reveal>
          <h2 className="hcine__flow-title" id="hflow-title">
            Where your files and your work finally meet
          </h2>
          <ol aria-labelledby="hflow-title">
            {steps.map((s, i) => (
              <li key={s.title}>
                <span className="hcine__step" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
        <Link to="/studio/proj-morning" className="hlink hlink--light">
          Open the Video Studio demo
          <Icon name="arrowRight" size={15} />
        </Link>
      </div>
    </section>
  );
}

/* Pricing ------------------------------------------------------------------ */

function Pricing() {
  const plans = [
    {
      id: 'creator',
      name: 'Haven Creator',
      for: 'For creators and small teams',
      items: ['Media library for raw footage and finished videos', 'Ideas, drafts, captions and platform versions', 'Multiple social accounts and a publishing calendar', 'Team members and access control as an add-on'],
    },
    {
      id: 'personal',
      name: 'Haven Personal',
      for: 'For your family’s long films',
      items: ['A private home for long-form videos', 'Titles, dates and notes for every film', 'Kept separate from creator work', 'Share a single film when you choose'],
    },
  ];
  return (
    <section className="hsec hpricing" id="pricing" aria-labelledby="hpricing-title">
      <div className="hcenter" data-reveal>
        <Eyebrow>Pricing</Eyebrow>
        <h2 className="htitle" id="hpricing-title">
          Two plans, each with one clear purpose.
        </h2>
        <p className="hlede">Prices aren’t set yet. Below is what each plan is planned to include. We’ll publish prices before anyone is asked to pay.</p>
      </div>
      <ul className="hplans" data-reveal>
        {plans.map((p) => (
          <li key={p.id} className={`hplan hplan--${p.id}`}>
            <div>
              <h3 className="hplan__name">{p.name}</h3>
              <p className="hplan__for">{p.for}</p>
            </div>
            <div className="hplan__price">
              <span className="hplan__label">Proposed pricing</span>
              <span className="hplan__amount">Price to be announced</span>
              <Tag kind="planned" />
            </div>
            <ul className="hplan__items">
              {p.items.map((it) => (
                <li key={it}>
                  <Icon name="check" size={16} /> {it}
                </li>
              ))}
            </ul>
            <Link to={`/signup?plan=${p.id}`} className={`hbtn hbtn--lg ${p.id === 'creator' ? 'hbtn--primary' : 'hbtn--outline'}`} aria-label={`Preview sign-up for ${p.name}`}>
              Preview sign-up
            </Link>
          </li>
        ))}
      </ul>
      <p className="hfine hfine--center">Payments aren’t active. No card details are requested anywhere in this preview.</p>
    </section>
  );
}

/* Trust -------------------------------------------------------------------- */

function Trust() {
  const items: { icon: IconName; title: string; body: string; kind: 'planned' | 'commitment' }[] = [
    { icon: 'key', title: 'Passwords and passkeys', body: 'Secure password sign-in plus passkeys (WebAuthn), so your face or fingerprint never leaves your device.', kind: 'planned' },
    { icon: 'shield', title: 'Encrypted in transit and at rest', body: 'Files and details encrypted on the way to Haven and while they’re stored.', kind: 'planned' },
    { icon: 'user', title: 'Private by default', body: 'Spaces and roles decide who sees what. Creator work and Personal films stay separate.', kind: 'planned' },
    { icon: 'accounts', title: 'Never your social passwords', body: 'Haven will never ask for the passwords to your social accounts.', kind: 'commitment' },
    { icon: 'check', title: 'You publish, not Haven', body: 'Haven doesn’t post on your behalf. Every post goes out when you send it.', kind: 'commitment' },
  ];
  return (
    <section className="hsec htrust" aria-labelledby="htrust-title">
      <div className="hsplit" data-reveal>
        <div>
          <Eyebrow>Security and privacy</Eyebrow>
          <h2 className="htitle htitle--md" id="htrust-title">
            Built to be trusted with what you can’t replace.
          </h2>
        </div>
        <p className="hlede hsplit__aside">
          Haven isn’t live yet, so these are the protections we’re building toward, not ones you can rely on today. The current preview keeps everything in your
          browser.
        </p>
      </div>
      <ul className="htrust__list" data-reveal>
        {items.map((it) => (
          <li key={it.title}>
            <span className="htrust__icon" aria-hidden="true">
              <Icon name={it.icon} size={18} />
            </span>
            <h3>{it.title}</h3>
            <p>{it.body}</p>
            <Tag kind={it.kind} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/* FAQ ---------------------------------------------------------------------- */

const FAQ: { q: string; a: string }[] = [
  { q: 'Can I use Haven today?', a: 'Not yet. Haven is in an early preview. You can explore the creator workspace demo with sample data and try the sample sign-in and sign-up screens, but there are no real accounts yet.' },
  { q: 'Is the workspace demo real?', a: 'It’s the real interface running on sample data. Everything happens in your browser: files you choose stay in that tab, nothing is uploaded, and changes reset when you reload.' },
  { q: 'What’s the difference between Creator and Personal?', a: 'Haven Creator is a workspace for making content: footage, drafts, captions, accounts, versions and a calendar. Haven Personal is a separate, private home for long videos like wedding films and family edits. They’re planned as separate plans.' },
  { q: 'Will Haven post to my social accounts?', a: 'No. You post on each platform yourself. In Haven you mark a version as posted and add its link, so your calendar and gallery stay accurate.' },
  { q: 'Does Haven need my social media passwords?', a: 'No, and it never will. Each person signs in to Haven as themselves; an account handle only identifies which account a post is for.' },
  { q: 'How much will it cost?', a: 'Prices haven’t been set. We’ll publish them before anyone is asked to pay, and no payment details are collected in this preview.' },
  { q: 'Can my team work with me?', a: 'Yes, as an optional extra in Haven Creator. You can preview invitations and per-account access in the demo; real accounts and server-side access control are planned.' },
];

function Faq() {
  return (
    <section className="hsec hfaq" aria-labelledby="hfaq-title">
      <div className="hfaq__head" data-reveal>
        <Eyebrow>Questions</Eyebrow>
        <h2 className="htitle htitle--md" id="hfaq-title">
          Frequently asked
        </h2>
        <p className="hlede">Straight answers about what Haven is today and what’s still to come.</p>
      </div>
      <div className="hfaq__list" data-reveal>
        {FAQ.map((f) => (
          <details key={f.q} className="hfaq__item">
            <summary>
              {f.q}
              <span className="hfaq__mark" aria-hidden="true">
                <Icon name="plus" size={16} />
              </span>
            </summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* Finale and footer ---------------------------------------------------------- */

function Finale() {
  return (
    <section className="hfinale" aria-labelledby="hfinale-title">
      <div className="hfinale__inner" data-reveal>
        <BrandLogo variant="symbol" height={76} decorative />
        <span className="hfinale__rule" aria-hidden="true" />
        <h2 className="hfinale__title" id="hfinale-title">
          Creators belong here.
        </h2>
        <p>Walk through the workspace now, or preview what signing up will look like.</p>
        <div className="hhero__ctas hfinale__ctas">
          <Link to="/signup" className="hbtn hbtn--primary hbtn--lg">
            Get started
            <Icon name="arrowRight" size={16} />
          </Link>
          <Link to="/app" className="hbtn hbtn--outline hbtn--lg">
            Explore the workspace demo
          </Link>
        </div>
      </div>
    </section>
  );
}

function HomeFooter() {
  return (
    <footer className="hfoot">
      <div className="hfoot__inner">
        <div className="hfoot__brand">
          <BrandLogo variant="horizontal" height={26} />
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
      <div className="hfoot__base">
        <p>© {new Date().getFullYear()} Haven · Early preview. Features marked planned aren’t available yet.</p>
        <p className="hfoot__tagline">Creators belong here.</p>
      </div>
    </footer>
  );
}
