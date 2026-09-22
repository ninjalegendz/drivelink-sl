import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Poppins } from "next/font/google";
import "./globals.css";
import { NavigationProgress } from "@/components/layout/NavigationProgress";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
import { NumberInputWheelGuard } from "@/components/ui/NumberInputWheelGuard";
import { TrafficAnalytics } from "@/components/analytics/TrafficAnalytics";
import { PostHogAnalytics } from "@/components/analytics/PostHogAnalytics";

// Poppins is the ONE brand typeface - body, headings and monospace slots all
// resolve to it (see the --font-* tokens in globals.css). Weights match the
// utilities actually used across the app: normal/medium/semibold/bold/extrabold.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://drivelink.lk"),
  title: {
    default: "DriveLink SL: Vehicle Rentals in Sri Lanka",
    template: "%s | DriveLink SL",
  },
  description:
    "Compare vehicle rentals across Sri Lanka. See each listing's provider, terms and recorded checks before you request.",
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
    title: "DriveLink SL: Vehicle Rentals in Sri Lanka",
    description:
      "Compare cars, vans, SUVs, bikes and tuk-tuks across Sri Lanka. DriveLink booking requests cost Rs. 0.",
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
    <html lang="en" className={poppins.variable}>
      {/* Chrome fires beforeinstallprompt very early, routinely before React
          has hydrated. A listener attached on mount therefore misses it and the
          install offer never appears at all. This catches the event before the
          app is running and parks it for InstallPrompt to pick up. Inline on
          purpose: a separate file would load too late to be the point. */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.__dlInstallEvent=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__dlInstallEvent=e;});",
          }}
        />
      </head>
      {/* Body bg + gradient lives in globals.css so the layered radial-
          gradients can be fixed-attached. Font + base text colour here. */}
      <body className="font-sans bg-slate-50 text-slate-900 antialiased" suppressHydrationWarning>
        {/* Suspense because NavigationProgress reads useSearchParams; without a
            boundary that would opt every page out of static rendering. */}
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        {children}
        <TrafficAnalytics />
        {/* Same Suspense reason as above: it reads useSearchParams, because the
            search page keeps its filters in the query string. */}
        <Suspense fallback={null}>
          <PostHogAnalytics />
        </Suspense>
        <ServiceWorkerRegister />
        <OfflineBanner />
        {/* Stops the wheel editing a focused number field while someone is
            just scrolling the page. One mount covers every form in the app. */}
        <NumberInputWheelGuard />
      </body>
    </html>
  );
}
