import type { Metadata, Viewport } from "next";

import { AuthProvider } from "@/components/providers/auth-provider";
import { AuthSheet } from "@/components/auth-sheet";
import { getSiteUrl } from "@/lib/site";

import "./globals.css";

export const metadata: Metadata = {
  title: "Turm | Rental Matches That Move Fast",
  description:
    "Swipe-ready rental discovery for tenants, owners, and brokers across India.",
  metadataBase: new URL(getSiteUrl())
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
        <AuthProvider>
          {children}
          <AuthSheet />
        </AuthProvider>
      </body>
    </html>
  );
}
