import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

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

export const metadata: Metadata = {
  title: { default: "Gold & Silver Billing", template: "%s · Gold & Silver Billing" },
  description: "GST billing for gold and silver jewellery.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#f6f5f2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${figtree.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
