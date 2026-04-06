import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SportsBot — NBA AI Analytics",
  description:
    "Multi-agent AI for live NBA stats, game predictions, and historical analysis",
  openGraph: {
    title: "SportsBot",
    description: "Ask anything about NBA — live stats, predictions, history",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
