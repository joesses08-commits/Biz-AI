import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jimmy AI — AI Business Intelligence",
  description: "An AI COO for your business. Fully integrated platform and analysis.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icon-192.png",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#0a0a0a" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>{children}</body>
    </html>
  );
}
