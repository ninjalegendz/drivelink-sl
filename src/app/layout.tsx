import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://drivelink.lk"),
  title: {
    default: "DriveLink SL: Verified Vehicle Rentals in Sri Lanka",
    template: "%s | DriveLink SL",
  },
  description:
    "Find verified, affordable car rentals across Sri Lanka. ID-verified renters, trusted agencies.",
  keywords: ["car rental sri lanka", "rent a car colombo", "self drive sri lanka"],
  manifest: "/manifest.json",
  applicationName: "DriveLink",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DriveLink",
  },
  openGraph: {
    type: "website",
    siteName: "DriveLink SL",
    title: "DriveLink SL: Verified Vehicle Rentals in Sri Lanka",
    description:
      "Rent verified cars, vans, SUVs, bikes and tuk-tuks across Sri Lanka. Self-drive, with a driver, or airport pickup. No platform fees.",
    url: "/",
    locale: "en_LK",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      {/* Body bg + gradient lives in globals.css so the layered radial-
          gradients can be fixed-attached. Font + base text colour here. */}
      <body className="font-sans bg-slate-50 text-slate-900 antialiased" suppressHydrationWarning>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
