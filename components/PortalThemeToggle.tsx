"use client";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export default function PortalThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-xl border border-bg-border hover:bg-bg-hover transition"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
      {theme === "dark"
        ? <Sun size={15} style={{ color: "var(--text-muted)" }} />
        : <Moon size={15} style={{ color: "var(--text-muted)" }} />}
    </button>
  );
}
