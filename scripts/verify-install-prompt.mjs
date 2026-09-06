#!/usr/bin/env node
/*
 * The "add to home screen" offer on the homepage.
 *
 * It cannot fire by itself: Chrome only allows prompt() inside a real tap, and
 * iOS Safari has no install API at all. So the prompt appears on its own and
 * installs in one tap, and the job of this script is to prove it appears for
 * the people who can act on it and stays quiet for everyone else.
 *
 * Quiet matters as much as visible here. A banner that shows on a desktop, or
 * inside the already-installed app, or on every single visit, is the kind of
 * thing people learn to close without reading.
 *
 * Usage: node scripts/verify-install-prompt.mjs   (needs a dev server)
 */
import { chromium } from "playwright";

const BASE = process.env.DRIVELINK_TEST_BASE || "http://localhost:3000";
const PHONE = { width: 390, height: 844 };
const IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

let ok = true;
const chk = (l, c, x = "") => { if (!c) ok = false; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "   " + x : ""}`); };

// The banner waits before appearing so it does not fight first paint.
const SETTLE = 6500;

const browser = await chromium.launch();

/** Opens the homepage and reports what the banner did. */
async function run({ ua, viewport, fireInstallEvent = false, standalone = false, storage = null }) {
  const ctx = await browser.newContext({
    userAgent: ua,
    viewport,
    isMobile: viewport.width < 700,
    hasTouch: viewport.width < 700,
  });

  if (standalone) {
    await ctx.addInitScript(() => {
      const real = window.matchMedia.bind(window);
      window.matchMedia = (q) =>
        q.includes("display-mode: standalone") ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : real(q);
    });
  }
  if (storage) {
    await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch {} }, storage);
  }
  // Chromium will not emit beforeinstallprompt on demand, so the page is handed
  // one that behaves like the real thing: preventable, prompt-able, resolvable.
  if (fireInstallEvent) {
    await ctx.addInitScript(() => {
      window.__installPrompted = false;
      window.addEventListener("load", () => {
        const e = new Event("beforeinstallprompt", { cancelable: true });
        e.prompt = async () => { window.__installPrompted = true; };
        e.userChoice = Promise.resolve({ outcome: "accepted" });
        window.dispatchEvent(e);
      });
    });
  }

  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForTimeout(SETTLE);

  const state = await page.evaluate(() => {
    const el = document.querySelector('[aria-label="Add DriveLink to your home screen"]');
    if (!el) return { shown: false };
    const text = el.textContent ?? "";
    return {
      shown: true,
      hasAddButton: [...el.querySelectorAll("button")].some((b) => b.textContent.trim() === "Add"),
      hasIosSteps: /Add to Home Screen/i.test(text),
    };
  });
  return { ctx, page, state };
}

try {
  const probe = await fetch(`${BASE}/login`).then((r) => r.text()).catch(() => "");
  if (!/DriveLink/i.test(probe)) throw new Error(`${BASE} is not serving DriveLink. Start the dev server first.`);

  // ── Android: the real prompt, one tap ──
  {
    const { ctx, page, state } = await run({ ua: ANDROID_UA, viewport: PHONE, fireInstallEvent: true });
    chk("Android: the banner appears on its own", state.shown, JSON.stringify(state));
    chk("Android: it offers a one-tap Add, not instructions", state.hasAddButton && !state.hasIosSteps);

    // Exact role match, and no catch. A swallowed click error once made a
    // working feature look broken here for longer than it should have.
    await page.getByRole("button", { name: "Add", exact: true }).click({ timeout: 8000 });
    await page.waitForTimeout(1000);
    chk("Android: tapping Add calls the browser's install prompt",
      await page.evaluate(() => window.__installPrompted === true));
    chk("Android: the banner closes afterwards",
      await page.evaluate(() => !document.querySelector('[aria-label="Add DriveLink to your home screen"]')));
    await ctx.close();
  }

  // ── iOS: instructions, because there is no API ──
  {
    const { ctx, state } = await run({ ua: IOS_UA, viewport: PHONE });
    chk("iOS Safari: the banner appears without any install event", state.shown, JSON.stringify(state));
    chk("iOS Safari: it shows the Share steps, not a dead Add button",
      state.hasIosSteps && !state.hasAddButton);
    await ctx.close();
  }

  // ── The quiet cases ──
  {
    const { ctx, state } = await run({ ua: ANDROID_UA, viewport: { width: 1440, height: 900 }, fireInstallEvent: true });
    chk("desktop: stays quiet", !state.shown);
    await ctx.close();
  }
  {
    const { ctx, state } = await run({ ua: ANDROID_UA, viewport: PHONE, fireInstallEvent: true, standalone: true });
    chk("already installed: stays quiet", !state.shown);
    await ctx.close();
  }
  {
    const { ctx, state } = await run({
      ua: ANDROID_UA, viewport: PHONE, fireInstallEvent: true,
      storage: ["drivelink-install-dismissed", String(Date.now())],
    });
    chk("dismissed recently: stays quiet", !state.shown);
    await ctx.close();
  }
  {
    const old = Date.now() - 40 * 24 * 60 * 60 * 1000; // 40 days ago
    const { ctx, state } = await run({
      ua: ANDROID_UA, viewport: PHONE, fireInstallEvent: true,
      storage: ["drivelink-install-dismissed", String(old)],
    });
    chk("dismissed long ago: asks again", state.shown);
    await ctx.close();
  }
} catch (e) {
  ok = false;
  console.error("\nRUN FAILED:", e.message);
} finally {
  await browser.close();
}

console.log(ok ? "\nINSTALL PROMPT: offered where it works, quiet everywhere else." : "\nINSTALL PROMPT: FAILED");
process.exit(ok ? 0 : 1);
