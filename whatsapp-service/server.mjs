// DriveLink WhatsApp service (Baileys).
//
// A small always-on Node process that holds ONE WhatsApp Web session and lets
// the DriveLink Cloudflare Worker send messages over HTTP. It cannot live in
// the Worker (Baileys needs a persistent socket + disk), so it runs here on the
// VPS under pm2, behind nginx, and is reached at https://wa.drivelink.lk.
//
// Endpoints (all but /health require `Authorization: Bearer <WA_SERVICE_TOKEN>`):
//   GET  /health  -> { ok, connected }            (no auth — for nginx/uptime)
//   GET  /status  -> { connected, user }
//   GET  /qr      -> { connected, qr }             (qr = data-URL to scan)
//   POST /send    -> { to, message } -> { ok, id }
//   POST /logout  -> wipes the session, re-pairs

import { rm } from "node:fs/promises";
import express from "express";
import qrcode from "qrcode";
import pino from "pino";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
} from "@whiskeysockets/baileys";

const PORT     = Number(process.env.PORT || 3400);
const TOKEN    = process.env.WA_SERVICE_TOKEN || "";
const AUTH_DIR = process.env.WA_AUTH_DIR || "./auth";

const logger = pino({ level: "warn" });

let sock      = null;
let latestQr  = null;  // data-URL string while pairing, null once connected
let connected = false;
let meUser    = null;

async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: Browsers.ubuntu("DriveLink"),
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (u) => {
    const { connection, lastDisconnect, qr } = u;

    if (qr) {
      latestQr  = await qrcode.toDataURL(qr);
      connected = false;
    }
    if (connection === "open") {
      connected = true;
      latestQr  = null;
      meUser    = sock.user ?? null;
      logger.warn("[wa] connected as %s", meUser?.id);
    }
    if (connection === "close") {
      connected = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        latestQr = null;
        meUser   = null;
        logger.warn("[wa] logged out — clearing session");
        await rm(AUTH_DIR, { recursive: true, force: true }).catch(() => {});
        setTimeout(startSock, 1500); // re-init -> emits a fresh QR
      } else {
        logger.warn("[wa] connection closed (%s) — reconnecting", code);
        setTimeout(startSock, 3000);
      }
    }
  });
}

startSock().catch((e) => logger.error(e, "[wa] startSock failed"));

const app = express();
app.use(express.json({ limit: "256kb" }));

// Health is public so nginx/uptime checks don't need the token.
app.get("/health", (_req, res) => res.json({ ok: true, connected }));

// Everything below requires the shared token.
app.use((req, res, next) => {
  if (!TOKEN) return res.status(500).json({ error: "WA_SERVICE_TOKEN not configured" });
  if ((req.headers.authorization || "") !== `Bearer ${TOKEN}`) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
});

app.get("/status", (_req, res) =>
  res.json({ connected, user: meUser ? { id: meUser.id, name: meUser.name ?? null } : null }),
);

app.get("/qr", (_req, res) => res.json({ connected, qr: connected ? null : latestQr }));

app.post("/send", async (req, res) => {
  const { to, message } = req.body || {};
  if (!to || !message)      return res.status(400).json({ error: "to and message required" });
  if (!connected || !sock)  return res.status(503).json({ error: "whatsapp not connected" });

  const jid = `${String(to).replace(/\D/g, "")}@s.whatsapp.net`;
  try {
    const r = await sock.sendMessage(jid, { text: String(message) });
    res.json({ ok: true, id: r?.key?.id ?? null });
  } catch (e) {
    logger.error(e, "[wa] send failed");
    res.status(500).json({ error: e?.message || "send failed" });
  }
});

app.post("/logout", async (_req, res) => {
  try { await sock?.logout(); } catch { /* may already be gone */ }
  connected = false; latestQr = null; meUser = null;
  await rm(AUTH_DIR, { recursive: true, force: true }).catch(() => {});
  setTimeout(startSock, 1500);
  res.json({ ok: true });
});

// Bind to localhost only — public access is via nginx (TLS) at wa.drivelink.lk.
app.listen(PORT, "127.0.0.1", () => logger.warn("[wa] listening on 127.0.0.1:%d", PORT));
