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
      <div>
        <strong>{brandLabel}</strong>
        {pageLabel ? <span>{pageLabel}</span> : null}
      </div>
    </Link>
  );
}
