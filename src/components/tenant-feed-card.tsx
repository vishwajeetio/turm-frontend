"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

export type TenantFeedCardStatItem = {
  label: string;
  value: string;
};

export type TenantFeedCardSection = {
  title: string;
  items?: string[];
  body?: string | null;
};

function TenantCardIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="ultra-feed-icon-svg">
      <path d={path} fill="currentColor" />
    </svg>
  );
}

export function TenantFeedCard({
  avatarSrc,
  avatarAlt,
  headline,
  subheadline,
  chips,
  score,
  stats,
  sections,
  mobileDetailsExpanded,
  onMobileDetailsExpandedChange,
  floatingActions,
  detailsFooter,
  className = "",
}: {
  avatarSrc: string;
  avatarAlt: string;
  headline: string;
  subheadline: string;
  chips: string[];
  score?: {
    value: string;
    label: string;
  };
  stats?: TenantFeedCardStatItem[];
  sections: TenantFeedCardSection[];
  mobileDetailsExpanded: boolean;
  onMobileDetailsExpandedChange: (next: boolean) => void;
  floatingActions?: ReactNode;
  detailsFooter?: ReactNode;
  className?: string;
}) {
  const desktopDetailRef = useRef<HTMLDivElement | null>(null);
  const mobileDetailRef = useRef<HTMLDivElement | null>(null);
  const [desktopCanScrollMore, setDesktopCanScrollMore] = useState(false);
  const [mobileCanScrollMore, setMobileCanScrollMore] = useState(false);

  function updateDesktopScrollHint() {
    if (!desktopDetailRef.current) {
      setDesktopCanScrollMore(false);
      return;
    }
    const node = desktopDetailRef.current;
    setDesktopCanScrollMore(node.scrollHeight - node.scrollTop - node.clientHeight > 16);
  }

  function updateMobileScrollHint() {
    if (!mobileDetailRef.current) {
      setMobileCanScrollMore(false);
      return;
    }
    const node = mobileDetailRef.current;
    setMobileCanScrollMore(node.scrollHeight - node.scrollTop - node.clientHeight > 16);
  }

  useEffect(() => {
    updateDesktopScrollHint();
  }, [chips, detailsFooter, headline, score?.label, score?.value, sections, stats, subheadline]);

  useEffect(() => {
    updateMobileScrollHint();
  }, [
    chips,
    detailsFooter,
    headline,
    mobileDetailsExpanded,
    score?.label,
    score?.value,
    sections,
    stats,
    subheadline,
  ]);

  return (
    <div className={`ultra-feed-card-layout ultra-feed-card-layout-tenant-profile ${className}`.trim()}>
      <div className="ultra-feed-card-content-shell">
        <div className="ultra-feed-tenant-profile-desktop">
          <div className="ultra-feed-tenant-profile-media-stage">
            <div className="ultra-feed-tenant-profile-media-panel">
              <img alt={avatarAlt} src={avatarSrc} />
            </div>
          </div>

          <aside
            className="ultra-feed-detail-scroll ultra-feed-tenant-profile-detail"
            onScroll={updateDesktopScrollHint}
            ref={desktopDetailRef}
          >
            {score ? (
              <div className="ultra-feed-score-pill">
                <strong>{score.value}</strong>
                {score.label}
              </div>
            ) : null}
            <h2>{headline}</h2>
            <p className="ultra-feed-muted">{subheadline}</p>

            <div className="ultra-feed-chip-row">
              {chips.map((chip) => (
                <span className="ultra-feed-chip" key={`desktop-chip-${chip}`}>
                  {chip}
                </span>
              ))}
            </div>

            {stats?.length ? (
              <div className="ultra-feed-stat-grid">
                {stats.map((item) => (
                  <article key={`${item.label}-${item.value}`}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </article>
                ))}
              </div>
            ) : null}

            {sections.map((section) => (
              <div className="ultra-feed-reasons" key={section.title}>
                <h3>{section.title}</h3>
                {section.items?.length ? (
                  <ul>
                    {section.items.map((item) => (
                      <li key={`${section.title}-${item}`}>{item}</li>
                    ))}
                  </ul>
                ) : null}
                {section.body ? <p className="ultra-feed-muted">{section.body}</p> : null}
              </div>
            ))}

            {detailsFooter}

            <button
              aria-label="Scroll details"
              className={`ultra-feed-scroll-indicator ${desktopCanScrollMore ? "" : "is-hidden"}`}
              onClick={() => desktopDetailRef.current?.scrollBy({ top: 180, behavior: "smooth" })}
              type="button"
            >
              <TenantCardIcon path="M12 16.6a1 1 0 0 1-.71-.3l-5-5a1 1 0 0 1 1.42-1.4L12 14.2l4.29-4.3a1 1 0 0 1 1.42 1.4l-5 5a1 1 0 0 1-.71.3z" />
            </button>
          </aside>
        </div>

        <div className="ultra-feed-tenant-profile-mobile">
          <div className="ultra-feed-mobile-image-wrap ultra-feed-tenant-profile-mobile-image-wrap">
            <img alt={avatarAlt} src={avatarSrc} />
          </div>

          <section className={`ultra-feed-mobile-detail-sheet ${mobileDetailsExpanded ? "is-expanded" : ""}`}>
            <div className="ultra-feed-mobile-detail-summary">
              <div>
                <h3>{headline}</h3>
                <p>{subheadline}</p>
              </div>
              <button
                aria-label={mobileDetailsExpanded ? "Collapse details" : "Expand details"}
                className="ultra-feed-mobile-sheet-toggle"
                onClick={() => onMobileDetailsExpandedChange(!mobileDetailsExpanded)}
                type="button"
              >
                <TenantCardIcon
                  path={
                    mobileDetailsExpanded
                      ? "M6.7 14.8a1 1 0 0 1 1.41 0L12 18.69l3.89-3.9a1 1 0 1 1 1.42 1.42l-4.6 4.59a1 1 0 0 1-1.42 0l-4.6-4.59a1 1 0 0 1 0-1.42z"
                      : "M17.3 9.2a1 1 0 0 1-1.41 0L12 5.31 8.11 9.2a1 1 0 0 1-1.42-1.42l4.6-4.59a1 1 0 0 1 1.42 0l4.6 4.59a1 1 0 0 1 0 1.42z"
                  }
                />
              </button>
            </div>

            <div
              className="ultra-feed-mobile-detail-scroll ultra-feed-tenant-profile-mobile-scroll"
              onScroll={updateMobileScrollHint}
              ref={mobileDetailRef}
            >
              <div className="ultra-feed-chip-row">
                {chips.map((chip) => (
                  <span className="ultra-feed-chip" key={`mobile-chip-${chip}`}>
                    {chip}
                  </span>
                ))}
              </div>

              {stats?.length ? (
                <div className="ultra-feed-stat-grid">
                  {stats.map((item) => (
                    <article key={`mobile-${item.label}-${item.value}`}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </article>
                  ))}
                </div>
              ) : null}

              {sections.map((section) => (
                <div className="ultra-feed-reasons" key={`mobile-${section.title}`}>
                  <h3>{section.title}</h3>
                  {section.items?.length ? (
                    <ul>
                      {section.items.map((item) => (
                        <li key={`mobile-${section.title}-${item}`}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                  {section.body ? <p className="ultra-feed-muted">{section.body}</p> : null}
                </div>
              ))}

              {detailsFooter}
            </div>

            <button
              aria-label="Scroll details"
              className={`ultra-feed-scroll-indicator ultra-feed-scroll-indicator-mobile ${
                mobileCanScrollMore ? "" : "is-hidden"
              }`}
              onClick={() => mobileDetailRef.current?.scrollBy({ top: 180, behavior: "smooth" })}
              type="button"
            >
              <TenantCardIcon path="M12 16.6a1 1 0 0 1-.71-.3l-5-5a1 1 0 0 1 1.42-1.4L12 14.2l4.29-4.3a1 1 0 0 1 1.42 1.4l-5 5a1 1 0 0 1-.71.3z" />
            </button>
          </section>
        </div>
      </div>

      {floatingActions ? (
        <div className="ultra-feed-floating-actions ultra-feed-floating-actions-inline">
          {floatingActions}
        </div>
      ) : null}
    </div>
  );
}
