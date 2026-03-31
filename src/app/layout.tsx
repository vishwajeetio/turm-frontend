import type { Metadata, Viewport } from "next";

import { AppExperiencePrompt } from "@/components/app-experience-prompt";
import { AuthProvider } from "@/components/providers/auth-provider";
import { UiBlockerProvider } from "@/components/providers/ui-blocker-provider";
import { AuthSheet } from "@/components/auth-sheet";
import { getSiteUrl } from "@/lib/site";

import "./globals.css";

export const metadata: Metadata = {
  title: "Turm | Rental Matches That Move Fast",
  description:
    "Swipe-ready rental discovery for tenants, owners, and brokers across India.",
  metadataBase: new URL(getSiteUrl()),
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Turm",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <UiBlockerProvider>
          <AuthProvider>
            {children}
            <AuthSheet />
            <AppExperiencePrompt />
          </AuthProvider>
        </UiBlockerProvider>
      </body>
    </html>
  );
}
