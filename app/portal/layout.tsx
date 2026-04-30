"use client";
import { ThemeProvider } from "@/components/ThemeProvider";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {children}
    </ThemeProvider>
  );
}
