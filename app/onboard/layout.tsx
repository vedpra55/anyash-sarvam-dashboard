import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Add your parent · Anyash",
  description: "A friendly check-in call for your mom or dad, every day, in their own language. Takes about 2 minutes.",
  // The link carries a private token: keep it out of search results and referrers.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  openGraph: {
    title: "Add your parent to Anyash",
    description: "A friendly check-in call for your mom or dad, every day, in their own language. Takes about 2 minutes.",
    siteName: "Anyash",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#FAF7F2",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Android: the page shrinks above the keyboard, so the Next button stays visible.
  interactiveWidget: "resizes-content",
};

/** The public form is light and warm, unlike the dark dashboard. */
export default function OnboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`html{color-scheme:light}body{background:#FAF7F2;color:#1C1A17}::selection{background:rgba(254,229,165,.7);color:#1C1A17}`}</style>
      {children}
    </>
  );
}
