"use client";

import Image from "next/image";
import Link from "next/link";

export function SiteLogoLink({
  brandLabel = "Turm",
  pageLabel,
  className = "",
}: {
  brandLabel?: string;
  pageLabel?: string;
  className?: string;
}) {
  return (
    <Link className={`ultra-feed-header-left site-logo-link ${className}`.trim()} href="/">
      <span className="ultra-feed-brand-mark">
        <Image
          alt="Turm"
          className="site-logo-mark-image"
          height={42}
          priority
          src="/brand-mark.svg"
          width={42}
        />
      </span>
      <div className="site-logo-copy">
        <strong className="site-logo-brand-label">{brandLabel}</strong>
        {pageLabel ? <span className="site-logo-page-label">{pageLabel}</span> : null}
      </div>
    </Link>
  );
}
