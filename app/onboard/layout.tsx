import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import localFont from "next/font/local";

// The same type as anyash.vercel.app: Plus Jakarta Sans, and Playlist Script for handwritten accents.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const playlist = localFont({
  src: "../../public/fonts/playlist-script.otf",
  variable: "--font-playlist",
  display: "swap",
});

const DESCRIPTION = "A friendly daily check-in call for your mom or dad, in their own language. Takes about 2 minutes.";

export const metadata: Metadata = {
  title: "Add your parent · Anyash",
  description: DESCRIPTION,
  // The link carries a private token: keep it out of search results and referrers.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  icons: { icon: "/onboard/logo-icon.png", apple: "/onboard/logo-icon.png" },
  openGraph: {
    title: "Add your parent to Anyash",
    description: DESCRIPTION,
    siteName: "Anyash",
    type: "website",
    images: [{ url: "/onboard/with-parent.webp", width: 720, height: 591, alt: "A mother smiling on a phone call" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#FAFAFA",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Android: the page shrinks above the keyboard, so the Next button stays visible.
  interactiveWidget: "resizes-content",
};

/** The public form uses the brand's light theme, unlike the dark dashboard. */
export default function OnboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id="ob-root" className={`${jakarta.variable} ${playlist.variable} font-jakarta`}>
      <style>{`html{color-scheme:light}body{background:#FAFAFA;color:#202724}::selection{background:rgba(23,74,64,.18);color:#202724}:focus-visible:not(input):not(textarea):not(select){outline-color:#174A40}h1[tabindex="-1"]:focus,h1[tabindex="-1"]:focus-visible{outline:none}`}</style>
      {children}
    </div>
  );
}
