import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BizAI — AI Business Intelligence",
  description: "An AI COO for your business. Fully integrated platform and analysis.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
