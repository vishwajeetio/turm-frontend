import { SiteLogoLink } from "@/components/site-logo-link";

const socialLinks = [
  {
    label: "Instagram",
    href: "https://instagram.com/turmdotin",
    path: "M7.5 3h9A4.5 4.5 0 0 1 21 7.5v9a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3zm0 2A2.5 2.5 0 0 0 5 7.5v9A2.5 2.5 0 0 0 7.5 19h9a2.5 2.5 0 0 0 2.5-2.5v-9A2.5 2.5 0 0 0 16.5 5h-9zm9.75 1.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  },
  {
    label: "X",
    href: "https://x.com/turmdotin",
    path: "M4 4h4.74l4.3 5.73L17.9 4H20l-6 6.96L20.42 20h-4.74l-4.63-6.18L5.7 20H3.58l6.24-7.25L4 4zm3.74 1.8H6.86l9.44 12.4h.88L7.74 5.8z",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/turmdotin",
    path: "M5.5 8A1.5 1.5 0 1 0 5.5 5a1.5 1.5 0 0 0 0 3zM4 9h3v10H4zm5 0h2.87v1.37h.04c.4-.76 1.38-1.56 2.84-1.56 3.04 0 3.6 2 3.6 4.59V19h-3v-4.93c0-1.18-.02-2.69-1.64-2.69-1.65 0-1.9 1.28-1.9 2.6V19H9z",
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@turmdotin",
    path: "M21.6 7.2a2.8 2.8 0 0 0-1.97-1.98C17.9 4.75 12 4.75 12 4.75s-5.9 0-7.63.47A2.8 2.8 0 0 0 2.4 7.2 29 29 0 0 0 1.93 12a29 29 0 0 0 .47 4.8 2.8 2.8 0 0 0 1.97 1.98c1.73.47 7.63.47 7.63.47s5.9 0 7.63-.47a2.8 2.8 0 0 0 1.97-1.98 29 29 0 0 0 .47-4.8 29 29 0 0 0-.47-4.8zM10 15.5v-7l6 3.5-6 3.5z",
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/turmdotin",
    path: "M13.5 21v-7.2H16l.38-2.8h-2.88V9.2c0-.82.24-1.37 1.4-1.37H16.5V5.2c-.28-.04-1.23-.12-2.34-.12-2.32 0-3.91 1.42-3.91 4.03V11H7.8v2.8h2.45V21z",
  },
  {
    label: "Threads",
    href: "https://www.threads.net/@turmdotin",
    path: "M15.7 10.9c-.12-2.08-1.33-3.24-3.38-3.24-2.2 0-3.62 1.42-3.62 3.21 0 1.22.67 2.18 1.86 2.77-.36.18-.68.4-.96.68-.62.63-.95 1.47-.95 2.41 0 2.04 1.68 3.62 3.85 3.62 2.52 0 4.12-1.64 4.12-4.18 0-.8-.2-1.54-.59-2.2.7-.38 1.17-1.15 1.17-2.1 0-1.72-1.38-2.86-3.5-2.97zm-3.12 7.55c-1.15 0-1.96-.74-1.96-1.78 0-.52.18-.93.54-1.28.38-.37.95-.58 1.67-.58.49 0 .95.08 1.33.2.07.29.1.6.1.93 0 1.54-.64 2.51-1.68 2.51zm1.38-5.85a7.9 7.9 0 0 0-1.4-.13c-1.18 0-2.18.26-2.95.76-.54-.32-.84-.82-.84-1.42 0-.86.72-1.56 1.83-1.56 1.1 0 1.8.63 1.95 1.77.48.08.97.28 1.41.58zm.7 1.04c.38.33.59.75.59 1.22 0 .08-.01.16-.02.24-.4-.1-.82-.17-1.26-.2.2-.48.43-.89.69-1.26z",
  },
];

function SocialIcon({ path }: { path: string }) {
  return (
    <svg aria-hidden="true" className="site-footer-social-icon" viewBox="0 0 24 24">
      <path d={path} fill="currentColor" />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-top">
        <SiteLogoLink brandLabel="Turm" className="site-footer-brand" pageLabel="@turmdotin" />
        <div className="site-footer-socials" role="list" aria-label="Turm social media">
          {socialLinks.map((item) => (
            <a
              aria-label={item.label}
              className="site-footer-social-link"
              href={item.href}
              key={item.label}
              rel="noreferrer"
              role="listitem"
              target="_blank"
            >
              <SocialIcon path={item.path} />
            </a>
          ))}
        </div>
      </div>
      <p className="site-footer-copy">
        © {new Date().getFullYear()} Turm. All rights reserved.
      </p>
    </footer>
  );
}
