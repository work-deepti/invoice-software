import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { THEME_BOOT_SCRIPT, THEME_COLOR } from "@/lib/theme";

/* Figtree (OFL), self-hosted from src/fonts — works offline (DEP-07) and includes the ₹ sign. */
const figtree = localFont({
  variable: "--font-figtree",
  display: "swap",
  src: [
    { path: "../fonts/figtree/Figtree_400Regular.ttf", weight: "400", style: "normal" },
    { path: "../fonts/figtree/Figtree_500Medium.ttf", weight: "500", style: "normal" },
    { path: "../fonts/figtree/Figtree_600SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../fonts/figtree/Figtree_700Bold.ttf", weight: "700", style: "normal" },
    { path: "../fonts/figtree/Figtree_800ExtraBold.ttf", weight: "800", style: "normal" },
  ],
});

const DESCRIPTION = "GST invoices for jewellery shops, from today's gold and silver rates.";

/* Share previews need absolute URLs. On Vercel, Next uses the production domain by itself;
   set NEXT_PUBLIC_SITE_URL (e.g. https://billing.example.in) once a custom domain is added. */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  applicationName: "Gold & Silver Billing",
  title: { default: "Gold & Silver Billing", template: "%s · Gold & Silver Billing" },
  description: DESCRIPTION,
  manifest: "/manifest.webmanifest",
  appleWebApp: { title: "G&S Billing", statusBarStyle: "default" },
  // the image itself comes from app/opengraph-image.png and app/twitter-image.png
  openGraph: { type: "website", siteName: "Gold & Silver Billing", title: "Gold & Silver Billing", description: DESCRIPTION, locale: "en_IN" },
  twitter: { card: "summary_large_image", title: "Gold & Silver Billing", description: DESCRIPTION },
  robots: { index: false, follow: false }, // a private shop tool: keep it out of search results
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme is set by the boot script before React hydrates, hence suppressHydrationWarning
    <html lang="en-IN" className={`${figtree.variable} antialiased`} data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
