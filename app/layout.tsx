import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/anyash/Sidebar";

export const metadata: Metadata = {
  title: "Anyash",
  description: "Daily check-in calls, health memory and follow-ups for the parents you care for.",
};

export const viewport: Viewport = {
  themeColor: "#0B0C0E",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ay-canvas text-zinc-300 antialiased">
        {/* The shell and the data cache live here, so they persist across page changes. */}
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
