import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anyash",
  description: "Daily check-in calls, health memory and follow-ups for the parents you care for.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ay-canvas text-zinc-300 antialiased">
        {children}
      </body>
    </html>
  );
}
