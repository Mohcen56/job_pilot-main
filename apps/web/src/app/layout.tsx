import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JobHunt EZ",
  description:
    "Find matching jobs, build your resume, and research companies with JobHunt EZ, your AI-powered job hunting assistant.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background"><a href="#main-content" className="skip-link">Skip to content</a>{children}</body>
    </html>
  );
}
