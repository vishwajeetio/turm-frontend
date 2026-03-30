const DEFAULT_SITE_URL = "http://localhost:3000";

export function getSiteUrl(): string {
  const value =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    DEFAULT_SITE_URL;

  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_SITE_URL;
  }
}
