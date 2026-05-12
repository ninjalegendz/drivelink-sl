import type { CapacitorConfig } from "@capacitor/cli";

// DriveLink Capacitor wrapper.
//
// The Next.js app stays on Vercel — this APK is a thin WebView shell that
// loads the deployed site. `server.url` makes the WebView fetch the remote
// site on launch instead of bundled HTML, so server components, API routes,
// Supabase cookie auth, and middleware all keep working.
//
// `webDir` ("www") is only used when there's no network on first launch
// (Capacitor needs the dir to exist for cap sync — its contents are a
// "Connecting…" fallback in www/index.html).
const config: CapacitorConfig = {
  appId:   "lk.drivelink.app",
  appName: "DriveLink",
  webDir:  "www",
  server: {
    url: "https://drivelink-sl.vercel.app",
    androidScheme: "https",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
