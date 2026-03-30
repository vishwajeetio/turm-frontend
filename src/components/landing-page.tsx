"use client";

import Link from "next/link";

import { PublicSiteShell } from "@/components/public-site-shell";

const featureRows = [
  {
    title: "Mutual-like messaging",
    copy: "Tenants, owners, and brokers talk only after both sides say yes, keeping conversations high-intent."
  },
  {
    title: "Fast card preloading",
    copy: "The feed always keeps the next two candidates warm so swipes feel instant on web and mobile."
  },
  {
    title: "Verified rental workflows",
    copy: "Profiles, properties, agreements, charges, visits, and brokerage rules are modeled directly into the platform."
  }
];

const benefits = [
  "Phone-first Indian sign in",
  "Tenant and property recommendation feeds",
  "Premium plan controls like-back and multi-listing access",
  "Private listing discovery only for authenticated users",
  "Agreement, visit, and rent management ready in the backend",
  "Dark-only interface tuned for focus"
];

export function LandingPage() {
  return (
    <PublicSiteShell>
      <section className="hero-panel">
        <div className="hero-layout">
          <div className="hero-copy">
            <div className="eyebrow" style={{ marginTop: 0 }}>India rental matchmaking</div>
            <h1 style={{ fontSize: "clamp(3.8rem, 11vw, 7rem)", marginTop: 0 }}>
              Swipe into your
              <br />
              next rental.
            </h1>
            <p style={{ maxWidth: 760, marginTop: 18 }}>
              A dark-first rental platform for tenants, owners, and brokers. Discover
              monthly listings, express interest with one tap, and unlock chat only when
              both sides match.
            </p>
            <div className="action-row" style={{ marginTop: 24 }}>
              <Link className="primary-button" href="/login">
                Start with phone OTP
              </Link>
              <Link className="ghost-button" href="/pricing">
                Compare free vs premium
              </Link>
            </div>
            <div className="metrics-grid" style={{ marginTop: 28 }}>
              <div className="metric-panel">
                <strong>2</strong>
                <span className="muted">Buffered cards always ready behind the active swipe.</span>
              </div>
              <div className="metric-panel">
                <strong>50%</strong>
                <span className="muted">Hard brokerage cap for brokers, with visible extra charges.</span>
              </div>
              <div className="metric-panel">
                <strong>Dark</strong>
                <span className="muted">Focused, minimal UI across landing, feed, likes, chat, and management.</span>
              </div>
            </div>
          </div>

          <div className="surface" style={{ alignSelf: "stretch" }}>
            <div className="eyebrow">Platform benefits</div>
            <div className="grid-three" style={{ gridTemplateColumns: "1fr", marginTop: 8 }}>
              {featureRows.map((feature) => (
                <div className="feature-card" key={feature.title}>
                  <strong>{feature.title}</strong>
                  <p className="section-copy" style={{ marginTop: 10 }}>
                    {feature.copy}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="surface" style={{ marginTop: 22 }}>
        <div className="page-header">
          <div>
            <div className="eyebrow">Why it works</div>
            <h2 className="section-title" style={{ fontSize: "2.6rem" }}>
              A sharper rental flow for every side of the match.
            </h2>
          </div>
        </div>
        <div className="grid-two">
          <div className="surface" style={{ padding: 18 }}>
            <strong>For tenants</strong>
            <p className="section-copy" style={{ marginTop: 10 }}>
              Location-aware recommendations, accurate filters, verified listings, and
              frictionless chat once mutual interest is clear.
            </p>
          </div>
          <div className="surface" style={{ padding: 18 }}>
            <strong>For owners and brokers</strong>
            <p className="section-copy" style={{ marginTop: 10 }}>
              Structured property publishing, transparent charges, profile discovery, and
              premium controls for multiple active listings.
            </p>
          </div>
        </div>
        <div className="listing-grid" style={{ marginTop: 18 }}>
          {benefits.map((benefit) => (
            <div className="feature-card" key={benefit}>
              <strong>{benefit}</strong>
            </div>
          ))}
        </div>
      </section>
    </PublicSiteShell>
  );
}
