import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { SiteLogoLink } from "@/components/site-logo-link";

export function PublicSiteShell({
  children,
  pageLabel = "Rental discovery tuned for speed.",
}: {
  children: React.ReactNode;
  pageLabel?: string;
}) {
  return (
    <div className="page-shell public-page public-site-shell">
      <header className="ultra-feed-header public-site-header">
        <SiteLogoLink brandLabel="Turm" pageLabel={pageLabel} />
        <div className="public-site-header-actions">
          <Link className="ultra-feed-secondary-button public-site-nav-link" href="/">
            Home
          </Link>
          <Link className="ultra-feed-secondary-button public-site-nav-link" href="/pricing">
            Pricing
          </Link>
          <Link className="ultra-feed-primary-button" href="/login">
            Start with OTP
          </Link>
        </div>
      </header>

      <div className="public-site-content">{children}</div>
      <SiteFooter />
    </div>
  );
}
