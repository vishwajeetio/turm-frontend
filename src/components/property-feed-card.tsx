"use client";

import type {
  ReactNode,
  SetStateAction,
  WheelEvent as ReactWheelEvent,
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";

export type PropertyFeedCardMediaSlide = {
  id: string;
  src: string;
  alt: string;
  roomTag?: string | null;
  customTag?: string | null;
};

export type PropertyFeedCardStatItem = {
  label: string;
  value: string;
};

function PropertyCardIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="ultra-feed-icon-svg">
      <path d={path} fill="currentColor" />
    </svg>
  );
}

function formatTagLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const normalized = value.trim().replaceAll("_", " ");
  if (!normalized) {
    return null;
  }
  return normalized
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((chunk) => `${chunk.slice(0, 1).toUpperCase()}${chunk.slice(1)}`)
    .join(" ");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function PropertyFeedCard({
  headline,
  localityLine,
  chips,
  score,
  stats,
  reasonsTitle = "Why this matched",
  reasons,
  fallbackReason,
  media,
  activeImageIndex,
  onImageIndexChange,
  mobileDetailsExpanded,
  onMobileDetailsExpandedChange,
  onMediaWheel,
  disableMediaControls = false,
  floatingActions,
  detailsFooter,
  className = "",
}: {
  headline: string;
  localityLine: string;
  chips: string[];
  score?: {
    value: string;
    label: string;
  };
  stats?: PropertyFeedCardStatItem[];
  reasonsTitle?: string;
  reasons: string[];
  fallbackReason: string;
  media: PropertyFeedCardMediaSlide[];
  activeImageIndex: number;
  onImageIndexChange: (next: SetStateAction<number>) => void;
  mobileDetailsExpanded: boolean;
  onMobileDetailsExpandedChange: (next: boolean) => void;
  onMediaWheel?: (event: ReactWheelEvent<HTMLDivElement>) => void;
  disableMediaControls?: boolean;
  floatingActions?: ReactNode;
  detailsFooter?: ReactNode;
  className?: string;
}) {
  const fallbackSlides = useMemo<PropertyFeedCardMediaSlide[]>(
    () => [
      {
        id: "placeholder",
        src: "https://placehold.co/980x1280/0d1117/e6ecf3?text=Property",
        alt: "Property preview",
      },
    ],
    []
  );
  const slides = media.length ? media : fallbackSlides;
  const maxIndex = Math.max(slides.length - 1, 0);
  const normalizedIndex = clamp(activeImageIndex, 0, maxIndex);
  const desktopStartIndex = Math.min(normalizedIndex, Math.max(slides.length - 2, 0));
  const desktopMainSlide = slides[desktopStartIndex] ?? slides[0];
  const desktopSecondarySlide = slides[Math.min(desktopStartIndex + 1, maxIndex)] ?? desktopMainSlide;
  const mobileSlide = slides[normalizedIndex] ?? slides[0];
  const previousIndexRef = useRef(normalizedIndex);
  const [mediaShiftDirection, setMediaShiftDirection] = useState<"left" | "right" | null>(null);

  const desktopDetailRef = useRef<HTMLDivElement | null>(null);
  const mobileDetailRef = useRef<HTMLDivElement | null>(null);
  const [desktopCanScrollMore, setDesktopCanScrollMore] = useState(false);
  const [mobileCanScrollMore, setMobileCanScrollMore] = useState(false);

  useEffect(() => {
    const previousIndex = previousIndexRef.current;
    if (previousIndex === normalizedIndex) {
      return;
    }
    setMediaShiftDirection(normalizedIndex > previousIndex ? "left" : "right");
    previousIndexRef.current = normalizedIndex;
    const timer = window.setTimeout(() => {
      setMediaShiftDirection(null);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [normalizedIndex]);

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
  }, [headline, chips.length, reasons.length, stats?.length, normalizedIndex, detailsFooter]);

  useEffect(() => {
    updateMobileScrollHint();
  }, [headline, chips.length, reasons.length, stats?.length, mobileDetailsExpanded, normalizedIndex, detailsFooter]);

  const hasPrevious = normalizedIndex > 0;
  const hasNext = normalizedIndex < maxIndex;

  function renderMediaTags(slide: PropertyFeedCardMediaSlide, mobile = false) {
    const roomTag = formatTagLabel(slide.roomTag);
    const customTag = (slide.customTag ?? "").trim().slice(0, 30);
    if (!roomTag && !customTag) {
      return null;
    }
    return (
      <div className={`ultra-feed-media-tag-stack ${mobile ? "is-mobile" : ""}`}>
        {roomTag ? <span className="ultra-feed-media-tag">{roomTag}</span> : null}
        {customTag ? <span className="ultra-feed-media-tag is-custom">{customTag}</span> : null}
      </div>
    );
  }

  return (
    <div className={`ultra-feed-card-layout ultra-feed-card-layout-listing ${className}`.trim()}>
      <div className="ultra-feed-card-content-shell">
        <div className="ultra-feed-listing-desktop">
          <div className="ultra-feed-listing-media-stage">
            <button
              aria-label="Previous image"
              className="ultra-feed-image-arrow ultra-feed-image-arrow-left ultra-feed-image-arrow-edge"
              disabled={disableMediaControls || !hasPrevious}
              onClick={() =>
                onImageIndexChange((current) => Math.max(current - 1, 0))
              }
              type="button"
            >
              <PropertyCardIcon path="M15.2 4.4a1 1 0 0 1 0 1.4L9.99 11l5.2 5.2a1 1 0 1 1-1.4 1.42l-5.9-5.9a1 1 0 0 1 0-1.42l5.9-5.9a1 1 0 0 1 1.41 0z" />
            </button>

            <div
              className={`ultra-feed-listing-media-grid ${
                mediaShiftDirection ? `is-shifting-${mediaShiftDirection}` : ""
              }`}
              onWheel={onMediaWheel}
            >
              <div className="ultra-feed-media-panel ultra-feed-media-panel-main">
                <img alt={desktopMainSlide.alt} src={desktopMainSlide.src} />
                {renderMediaTags(desktopMainSlide)}
              </div>
              <div className="ultra-feed-media-panel ultra-feed-media-panel-secondary">
                <img alt={desktopSecondarySlide.alt} src={desktopSecondarySlide.src} />
                {renderMediaTags(desktopSecondarySlide)}
              </div>
            </div>

            <button
              aria-label="Next image"
              className="ultra-feed-image-arrow ultra-feed-image-arrow-right ultra-feed-image-arrow-edge"
              disabled={disableMediaControls || !hasNext}
              onClick={() =>
                onImageIndexChange((current) => Math.min(current + 1, maxIndex))
              }
              type="button"
            >
              <PropertyCardIcon path="M8.8 19.6a1 1 0 0 1 0-1.4L14.01 13l-5.2-5.2a1 1 0 1 1 1.4-1.42l5.9 5.9a1 1 0 0 1 0 1.42l-5.9 5.9a1 1 0 0 1-1.41 0z" />
            </button>
          </div>

          <aside className="ultra-feed-detail-scroll" onScroll={updateDesktopScrollHint} ref={desktopDetailRef}>
            {score ? (
              <div className="ultra-feed-score-pill">
                <strong>{score.value}</strong>
                {score.label}
              </div>
            ) : null}
            <h2>{headline}</h2>
            <p className="ultra-feed-muted">{localityLine}</p>

            <div className="ultra-feed-chip-row">
              {chips.map((chip, index) => (
                <span className="ultra-feed-chip" key={`desktop-chip-${index}-${chip}`}>
                  {chip}
                </span>
              ))}
              <span className="ultra-feed-chip">
                {normalizedIndex + 1}/{Math.max(slides.length, 1)} images
              </span>
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

            <div className="ultra-feed-reasons">
              <h3>{reasonsTitle}</h3>
              <ul>
                {(reasons.length ? reasons : [fallbackReason]).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>

            {detailsFooter}

            <button
              aria-label="Scroll details"
              className={`ultra-feed-scroll-indicator ${desktopCanScrollMore ? "" : "is-hidden"}`}
              onClick={() => desktopDetailRef.current?.scrollBy({ top: 180, behavior: "smooth" })}
              type="button"
            >
              <PropertyCardIcon path="M12 16.6a1 1 0 0 1-.71-.3l-5-5a1 1 0 0 1 1.42-1.4L12 14.2l4.29-4.3a1 1 0 0 1 1.42 1.4l-5 5a1 1 0 0 1-.71.3z" />
            </button>
          </aside>
        </div>

        <div className="ultra-feed-listing-mobile">
          <div className="ultra-feed-mobile-image-wrap">
            <img alt={mobileSlide.alt} src={mobileSlide.src} />
            <button
              aria-label="Previous image"
              className="ultra-feed-image-arrow ultra-feed-image-arrow-left"
              disabled={disableMediaControls || !hasPrevious}
              onClick={() =>
                onImageIndexChange((current) => Math.max(current - 1, 0))
              }
              type="button"
            >
              <PropertyCardIcon path="M15.2 4.4a1 1 0 0 1 0 1.4L9.99 11l5.2 5.2a1 1 0 1 1-1.4 1.42l-5.9-5.9a1 1 0 0 1 0-1.42l5.9-5.9a1 1 0 0 1 1.41 0z" />
            </button>
            <button
              aria-label="Next image"
              className="ultra-feed-image-arrow ultra-feed-image-arrow-right"
              disabled={disableMediaControls || !hasNext}
              onClick={() =>
                onImageIndexChange((current) => Math.min(current + 1, maxIndex))
              }
              type="button"
            >
              <PropertyCardIcon path="M8.8 19.6a1 1 0 0 1 0-1.4L14.01 13l-5.2-5.2a1 1 0 1 1 1.4-1.42l5.9 5.9a1 1 0 0 1 0 1.42l-5.9 5.9a1 1 0 0 1-1.41 0z" />
            </button>
          </div>

          <section className={`ultra-feed-mobile-detail-sheet ${mobileDetailsExpanded ? "is-expanded" : ""}`}>
            <div className="ultra-feed-mobile-tag-row">{renderMediaTags(mobileSlide, true)}</div>
            <div className="ultra-feed-mobile-detail-summary">
              <div>
                <h3>{headline}</h3>
                <p>{localityLine}</p>
              </div>
              <button
                aria-label={mobileDetailsExpanded ? "Collapse details" : "Expand details"}
                className="ultra-feed-mobile-sheet-toggle"
                onClick={() => onMobileDetailsExpandedChange(!mobileDetailsExpanded)}
                type="button"
              >
                <PropertyCardIcon
                  path={
                    mobileDetailsExpanded
                      ? "M6.7 14.8a1 1 0 0 1 1.41 0L12 18.69l3.89-3.9a1 1 0 1 1 1.42 1.42l-4.6 4.59a1 1 0 0 1-1.42 0l-4.6-4.59a1 1 0 0 1 0-1.42z"
                      : "M17.3 9.2a1 1 0 0 1-1.41 0L12 5.31 8.11 9.2a1 1 0 0 1-1.42-1.42l4.6-4.59a1 1 0 0 1 1.42 0l4.6 4.59a1 1 0 0 1 0 1.42z"
                  }
                />
              </button>
            </div>

            <div className="ultra-feed-mobile-detail-scroll" onScroll={updateMobileScrollHint} ref={mobileDetailRef}>
              <div className="ultra-feed-chip-row">
                {chips.map((chip, index) => (
                  <span className="ultra-feed-chip" key={`mobile-chip-${index}-${chip}`}>
                    {chip}
                  </span>
                ))}
                <span className="ultra-feed-chip">
                  {normalizedIndex + 1}/{Math.max(slides.length, 1)} images
                </span>
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

              <div className="ultra-feed-reasons">
                <h3>{reasonsTitle}</h3>
                <ul>
                  {(reasons.length ? reasons : [fallbackReason]).map((reason) => (
                    <li key={`mobile-${reason}`}>{reason}</li>
                  ))}
                </ul>
              </div>

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
              <PropertyCardIcon path="M12 16.6a1 1 0 0 1-.71-.3l-5-5a1 1 0 0 1 1.42-1.4L12 14.2l4.29-4.3a1 1 0 0 1 1.42 1.4l-5 5a1 1 0 0 1-.71.3z" />
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
