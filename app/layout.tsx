import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "BizAI — AI Business Intelligence",
  description: "ChatGPT for your company data. Upload, analyze, decide.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-bg-base">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
