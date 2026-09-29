import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anyash | Operator Control Room & Family Health Companion",
  description:
    "The central operator dashboard for Anyash. Autonomous parent check-in calls, proactive health memory, and decision triage for operators and families.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] antialiased">
        {children}
      </body>
    </html>
  );
}
