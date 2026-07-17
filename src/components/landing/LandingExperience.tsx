"use client";

import Link from "next/link";
import {
  type CSSProperties,
  useEffect,
  useRef,
  useState,
} from "react";

export interface LandingCategory {
  id: string;
  label: string;
  count: number;
}

export interface LandingDeadline {
  title: string;
  slug: string;
  date: string;
}

interface LandingExperienceProps {
  total: number;
  activeCategories: number;
  categories: LandingCategory[];
  upcoming: LandingDeadline | null;
}

const STORY_BEATS = [
  {
    label: "SHARE",
    title: "A flyer becomes a listing.",
    body: "Organizations turn scattered program details into one structured, source-linked place to start.",
  },
  {
    label: "REVIEW",
    title: "A listing becomes a possibility.",
    body: "Dates, eligibility, sources, missing details, and possible duplicates move through a human review workflow.",
  },
  {
    label: "DISCOVER",
    title: "A search becomes a signal.",
    body: "Students can filter or ask in plain English, while every result still comes from the approved directory.",
  },
  {
    label: "RESPOND",
    title: "A signal helps a community respond.",
    body: "Anonymous completed searches reveal where local interest is growing and where opportunity is still missing.",
  },
] as const;

const STORY_OUTRO = {
  label: "CONNECT",
  title: "The loop is already moving.",
  body: "Follow the signal into the live directory and see what the Triangle is sharing now.",
} as const;

const STORY_TOTAL = STORY_BEATS.length + 1;

const FEATURES = [
  {
    number: "01",
    title: "Ask it your way",
    body: "Describe the experience, schedule, location, or support you need. Plain-English search stays grounded in directory records.",
    href: "/explore",
    link: "Try a search",
  },
  {
    number: "02",
    title: "Compare what matters",
    body: "Put eligibility, cost, pay, schedule, location, and time commitment side by side before choosing a path.",
    href: "/compare",
    link: "Open compare",
  },
  {
    number: "03",
    title: "Keep the next step close",
    body: "Save opportunities on your device, build application checklists, and move deadlines into your calendar.",
    href: "/saved",
    link: "View saved",
  },
] as const;

function ArrowIcon({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d={diagonal ? "M5 15 15 5M7 5h8v8" : "M3 10h13M11 5l5 5-5 5"} />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 2c.8 8 5.2 12.4 14 14-8.8 1.6-13.2 6-14 14-.8-8-5.2-12.4-14-14C10.8 14.4 15.2 10 16 2Z" />
    </svg>
  );
}

export function LandingExperience({
  total,
  activeCategories,
  categories,
  upcoming,
}: LandingExperienceProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [activeStory, setActiveStory] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const storySteps = Array.from(root.querySelectorAll<HTMLElement>("[data-story-step]"));
    const revealItems = Array.from(root.querySelectorAll<HTMLElement>("[data-landing-reveal]"));
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reducedMotion = reducedMotionQuery.matches;
    const experienceShell = root.closest<HTMLElement>(".public-experience-shell");

    let scrollFrame = 0;
    const updateAmbientScene = () => {
      scrollFrame = 0;
      if (!experienceShell || reducedMotionQuery.matches) return;

      const bounds = root.getBoundingClientRect();
      const travel = Math.max(1, bounds.height - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -bounds.top / travel));
      const imageOpacity = 0.8 - progress * 0.14 + Math.sin(progress * Math.PI * 3) * 0.04;
      const networkOpacity = 0.72 + Math.sin(progress * Math.PI * 2.5) * 0.12;

      experienceShell.style.setProperty(
        "--public-ambient-image-opacity",
        imageOpacity.toFixed(3),
      );
      experienceShell.style.setProperty(
        "--public-ambient-network-opacity",
        networkOpacity.toFixed(3),
      );
      experienceShell.style.setProperty(
        "--public-ambient-shift-y",
        `${(-2.5 * progress).toFixed(2)}vh`,
      );
    };

    const queueAmbientSceneUpdate = () => {
      if (scrollFrame || reducedMotionQuery.matches) return;
      scrollFrame = window.requestAnimationFrame(updateAmbientScene);
    };

    if (experienceShell) {
      if (reducedMotion) {
        experienceShell.style.setProperty("--public-ambient-image-opacity", "0.74");
        experienceShell.style.setProperty("--public-ambient-network-opacity", "0.68");
        experienceShell.style.setProperty("--public-ambient-shift-y", "0vh");
      } else {
        updateAmbientScene();
        window.addEventListener("scroll", queueAmbientSceneUpdate, { passive: true });
        window.addEventListener("resize", queueAmbientSceneUpdate, { passive: true });
      }
    }

    if (reducedMotion) {
      revealItems.forEach((item) => item.classList.add("is-visible"));
      return () => {
        window.cancelAnimationFrame(scrollFrame);
        experienceShell?.style.removeProperty("--public-ambient-image-opacity");
        experienceShell?.style.removeProperty("--public-ambient-network-opacity");
        experienceShell?.style.removeProperty("--public-ambient-shift-y");
      };
    }

    root.classList.add("landing-motion-ready");

    const storyObserver = new IntersectionObserver(
      (entries) => {
        const strongest = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!strongest) return;
        const next = Number((strongest.target as HTMLElement).dataset.storyIndex);
        if (Number.isInteger(next)) setActiveStory(next);
      },
      { rootMargin: "-18% 0px -22%", threshold: [0.3, 0.5, 0.7] },
    );

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -10%", threshold: 0.12 },
    );

    storySteps.forEach((step) => storyObserver.observe(step));
    revealItems.forEach((item) => revealObserver.observe(item));

    return () => {
      storyObserver.disconnect();
      revealObserver.disconnect();
      window.removeEventListener("scroll", queueAmbientSceneUpdate);
      window.removeEventListener("resize", queueAmbientSceneUpdate);
      window.cancelAnimationFrame(scrollFrame);
      experienceShell?.style.removeProperty("--public-ambient-image-opacity");
      experienceShell?.style.removeProperty("--public-ambient-network-opacity");
      experienceShell?.style.removeProperty("--public-ambient-shift-y");
      root.classList.remove("landing-motion-ready");
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="landing-shell"
      data-ambient-scene="landing"
      data-ambient-render-sentinel
    >
      <section
        className="landing-hero"
        aria-labelledby="landing-title"
        data-ambient-scene="hero"
      >
        <div className="landing-cosmic-scrim" />
        <div className="landing-aurora landing-aurora-one" aria-hidden="true" />
        <div className="landing-aurora landing-aurora-two" aria-hidden="true" />

        <div className="landing-hero-frame">
          <p className="landing-scroll-cue">
            <span>SCROLL TO CONNECT</span>
            <i aria-hidden="true" />
          </p>

          <p className="landing-place-line">
            CHAPEL HILL <span>·</span> CARRBORO <span>·</span> DURHAM <span>·</span> RALEIGH
          </p>

          <h1 id="landing-title" className="landing-hero-title">
            <span className="landing-title-top">
              <span>Find</span> <span>your</span> <span>place</span>
            </span>
            <span className="landing-title-bottom">
              <span>in</span> <span>the</span> <span>Triangle.</span>
            </span>
          </h1>

          <div className="landing-hero-center">
            <p className="landing-hero-kicker">A COMMUNITY-POWERED OPPORTUNITY NETWORK</p>
            <p className="landing-hero-copy">
              Local internships, jobs, service, scholarships, mentorship, and programs—brought
              out of scattered inboxes and into one shared, searchable map.
            </p>
            <div className="landing-hero-actions">
              <Link href="/explore" className="landing-button landing-button-primary">
                Explore opportunities
                <ArrowIcon />
              </Link>
              <Link href="/submit" className="landing-button landing-button-ghost">
                Put one on the map
                <ArrowIcon diagonal />
              </Link>
            </div>
            <p className="landing-trust-line">
              Free to browse <span>·</span> no account required <span>·</span> sources stay visible
            </p>
          </div>

          <p className="landing-hero-meta landing-hero-meta-left">
            <span className="landing-live-dot" aria-hidden="true" />
            {total} {total === 1 ? "LISTING" : "LISTINGS"} OPEN
            <span className="landing-preview-label">PREVIEW DIRECTORY</span>
          </p>
          <p className="landing-hero-meta landing-hero-meta-right">RTP / CONNECTION 001</p>
        </div>
      </section>

      <section
        id="community-loop"
        className="landing-story"
        aria-label="How the community loop works"
        data-ambient-scene="story"
      >
        <div className="landing-story-stage" aria-hidden="true">
          <div className="landing-story-scrim" />

          <div className="landing-story-counter">
            <span>0{activeStory + 1}</span>
            <i />
            <span>0{STORY_TOTAL}</span>
          </div>

          <p className="landing-story-overline">ONE CONNECTION STRENGTHENS THE NEXT</p>
          <div className="landing-story-titles">
            {STORY_BEATS.map((beat, index) => (
              <p
                key={beat.title}
                className={[
                  "landing-story-title",
                  activeStory === index ? "is-active" : "",
                ].join(" ")}
              >
                {beat.title}
              </p>
            ))}
            <p
              className={[
                "landing-story-title",
                "landing-story-title-outro",
                activeStory === STORY_BEATS.length ? "is-active" : "",
              ].join(" ")}
            >
              {STORY_OUTRO.title}
            </p>
          </div>

          <div className="landing-story-progress">
            {[...STORY_BEATS, STORY_OUTRO].map((beat, index) => (
              <span key={beat.label} className={activeStory >= index ? "is-active" : ""} />
            ))}
          </div>
        </div>

        <div className="landing-story-steps">
          {STORY_BEATS.map((beat, index) => (
            <article
              key={beat.label}
              data-story-step
              data-story-index={index}
              className="landing-story-step"
            >
              <div className="landing-story-card">
                <p>
                  <span>0{index + 1}</span>
                  {beat.label}
                </p>
                <h2>{beat.title}</h2>
                <div>
                  <i aria-hidden="true" />
                  <p>{beat.body}</p>
                </div>
              </div>
            </article>
          ))}
          <article
            data-story-step
            data-story-index={STORY_BEATS.length}
            className="landing-story-step landing-story-outro"
          >
            <div className="landing-story-card landing-story-outro-card">
              <p>
                <span>0{STORY_TOTAL}</span>
                {STORY_OUTRO.label}
              </p>
              <h2>{STORY_OUTRO.title}</h2>
              <div>
                <i aria-hidden="true" />
                <p>{STORY_OUTRO.body}</p>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="landing-pulse" data-ambient-scene="directory">
        <div className="landing-section-grid">
          <div className="landing-section-heading" data-landing-reveal>
            <p className="landing-section-index">01 / THE LIVE DIRECTORY</p>
            <h2>
              A living map of
              <span>what&apos;s open now.</span>
            </h2>
          </div>
          <div className="landing-section-intro" data-landing-reveal>
            <p>
              Opportunity should not depend on who happens to know. RTP Pathway makes local
              knowledge visible, searchable, and easier to act on.
            </p>
            <Link href="/explore" className="landing-text-link">
              See everything open
              <ArrowIcon />
            </Link>
          </div>
        </div>

        <div className="landing-stat-grid" data-landing-reveal>
          <div className="landing-stat landing-stat-primary">
            <span>OPEN NOW</span>
            <strong>{String(total).padStart(2, "0")}</strong>
            <p>source-linked opportunities across the Triangle directory</p>
          </div>
          <div className="landing-stat">
            <span>ACTIVE PATHS</span>
            <strong>{String(activeCategories).padStart(2, "0")}</strong>
            <p>categories with something students can explore today</p>
          </div>
          <div className="landing-stat">
            <span>ANCHOR CITIES</span>
            <strong>04</strong>
            <p>plus nearby communities across the wider Research Triangle</p>
          </div>
        </div>

        {upcoming && (
          <Link
            href={"/opportunities/" + upcoming.slug}
            className="landing-deadline-strip"
            data-landing-reveal
          >
            <span className="landing-live-dot" aria-hidden="true" />
            <span>NEXT DIRECTORY DEADLINE</span>
            <strong>{upcoming.date}</strong>
            <p>{upcoming.title}</p>
            <ArrowIcon />
          </Link>
        )}
      </section>

      <section id="pathways" className="landing-pathways" data-ambient-scene="pathways">
        <div className="landing-section-grid">
          <div className="landing-section-heading" data-landing-reveal>
            <p className="landing-section-index">02 / PATHWAYS</p>
            <h2>
              Start with what
              <span>pulls you in.</span>
            </h2>
          </div>
          <div className="landing-section-intro" data-landing-reveal>
            <p>
              Every path opens the same directory, already focused on the kind of experience
              you want to find.
            </p>
          </div>
        </div>

        <ul className="landing-pathway-grid" data-landing-reveal>
          {categories.map((category, index) => (
            <li
              key={category.id}
              style={{ "--path-index": index } as CSSProperties}
            >
              <Link href={"/explore?category=" + category.id} className="landing-pathway-card">
                <span className="landing-pathway-orbit" aria-hidden="true">
                  <i />
                </span>
                <span className="landing-pathway-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <strong>{category.label}</strong>
                <span className="landing-pathway-count">
                  {category.count === 0
                    ? "None open right now"
                    : category.count + (category.count === 1 ? " opening" : " openings")}
                </span>
                <span className="landing-pathway-arrow">
                  <ArrowIcon diagonal />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="landing-tools" data-ambient-scene="tools">
        <div className="landing-section-grid">
          <div className="landing-section-heading" data-landing-reveal>
            <p className="landing-section-index">03 / FROM DISCOVERY TO ACTION</p>
            <h2>
              Find a fit. Make a
              <span>plan. Keep moving.</span>
            </h2>
          </div>
          <div className="landing-section-intro" data-landing-reveal>
            <p>
              RTP Pathway is more than a list. It helps you understand the options, hold onto
              the good ones, and turn interest into a next step.
            </p>
          </div>
        </div>

        <div className="landing-feature-grid">
          {FEATURES.map((feature, index) => (
            <article
              key={feature.number}
              className="landing-feature-card"
              data-landing-reveal
              style={{ "--feature-delay": index } as CSSProperties}
            >
              <div className="landing-feature-top">
                <span>{feature.number}</span>
                <SparkIcon />
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
              <Link href={feature.href}>
                {feature.link}
                <ArrowIcon />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section id="trust" className="landing-trust" data-ambient-scene="trust">
        <div className="landing-trust-glow" aria-hidden="true" />
        <div className="landing-trust-content">
          <p className="landing-section-index" data-landing-reveal>
            04 / BUILT FOR TRUST
          </p>
          <h2 data-landing-reveal>
            AI is the helper.
            <span>People are the source of trust.</span>
          </h2>
          <p className="landing-trust-copy" data-landing-reveal>
            AI can interpret a search or structure a submission, but it cannot invent an
            opportunity. Approved directory records stay underneath every result. Sources and
            dates stay visible. People decide what publishes.
          </p>

          <ol className="landing-loop-rail" data-landing-reveal>
            <li>
              <span>01</span>
              <strong>Share</strong>
              <p>Organizations submit structured details or paste an existing description.</p>
            </li>
            <li>
              <span>02</span>
              <strong>Review</strong>
              <p>The workflow checks sources, gaps, dates, and possible duplicates.</p>
            </li>
            <li>
              <span>03</span>
              <strong>Discover</strong>
              <p>Students search approved records and follow the original source.</p>
            </li>
            <li>
              <span>04</span>
              <strong>Learn</strong>
              <p>Anonymous demand signals help coordinators see what is still missing.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="landing-invitation" data-ambient-scene="invitation">
        <div className="landing-section-heading" data-landing-reveal>
          <p className="landing-section-index">05 / ADD YOUR CONNECTION</p>
          <h2>
            A network works when
            <span>everyone can add to it.</span>
          </h2>
        </div>

        <div className="landing-invitation-grid">
          <article className="landing-invitation-card landing-invitation-student" data-landing-reveal>
            <p>FOR STUDENTS</p>
            <h3>Looking for your next step?</h3>
            <span>
              Explore by interest, schedule, eligibility, location, cost, or simply describe
              what you need.
            </span>
            <Link href="/explore" className="landing-button landing-button-primary">
              Explore the directory
              <ArrowIcon />
            </Link>
          </article>
          <article className="landing-invitation-card landing-invitation-org" data-landing-reveal>
            <p>FOR ORGANIZATIONS</p>
            <h3>Know something Triangle teens should see?</h3>
            <span>
              Submit it once and send it through the same community review workflow used across
              the directory.
            </span>
            <Link href="/submit" className="landing-button landing-button-ghost">
              Share an opportunity
              <ArrowIcon diagonal />
            </Link>
          </article>
        </div>
      </section>

      <section
        className="landing-final"
        aria-labelledby="landing-final-title"
        data-ambient-scene="final"
      >
        <div className="landing-final-scrim" />
        <div className="landing-final-content">
          <p>EVERY PATH STARTS WITH A CONNECTION</p>
          <h2 id="landing-final-title">
            There is a place for you in the Triangle.
            <span>Let&apos;s find it.</span>
          </h2>
          <div>
            <Link href="/explore" className="landing-button landing-button-primary">
              Start exploring
              <ArrowIcon />
            </Link>
            <Link href="/submit" className="landing-button landing-button-ghost">
              Put one on the map
              <ArrowIcon diagonal />
            </Link>
          </div>
        </div>
        <p className="landing-final-mark">RTP PATHWAY</p>
      </section>
    </div>
  );
}
