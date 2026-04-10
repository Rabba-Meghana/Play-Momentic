import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PlayToMomentic — Playwright → Momentic Converter",
  description: "Convert Playwright test files to Momentic YAML using Groq AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
