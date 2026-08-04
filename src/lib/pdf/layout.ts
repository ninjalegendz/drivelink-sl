// Minimal pdf-lib layout helper: word-wrapped text with auto-pagination.
// pdf-lib runs on Cloudflare Workers (pure JS/WASM-free for our usage), so no
// headless browser or external service is needed. Shared by the agreement PDF
// and the evidence-pack summary.

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// Poppins is the only brand typeface, so generated PDFs embed it rather than
// falling back to pdf-lib's built-in Helvetica. The TTFs ship as static assets
// and are loaded through the ASSETS binding (no external round-trip, and no
// ~400KB of base64 added to the Worker bundle). Cached per isolate.
const POPPINS = {
  regular: "Poppins-Regular.ttf",
  bold:    "Poppins-SemiBold.ttf",
} as const;

let fontCache: Promise<{ regular: ArrayBuffer; bold: ArrayBuffer } | null> | null = null;

async function readAsset(file: string): Promise<ArrayBuffer | null> {
  // Preferred: the Worker's static-asset binding.
  try {
    const { env } = getCloudflareContext() as unknown as {
      env: { ASSETS?: { fetch: (req: Request) => Promise<Response> } };
    };
    if (env?.ASSETS) {
      const res = await env.ASSETS.fetch(new Request(`https://assets.local/fonts/${file}`));
      if (res.ok) return await res.arrayBuffer();
    }
  } catch { /* not on Workers (e.g. `next dev`): fall through */ }

  // Fallback: fetch over the public origin.
  try {
    const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
    if (!base) return null;
    const res = await fetch(`${base}/fonts/${file}`);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

function loadPoppins() {
  fontCache ??= (async () => {
    const [regular, bold] = await Promise.all([readAsset(POPPINS.regular), readAsset(POPPINS.bold)]);
    return regular && bold ? { regular, bold } : null;
  })();
  return fontCache;
}

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const INK = rgb(0.09, 0.11, 0.15);
const MUTED = rgb(0.42, 0.45, 0.5);
const RULE = rgb(0.8, 0.83, 0.87);

export class PdfBuilder {
  private doc!: PDFDocument;
  private page!: PDFPage;
  private font!: PDFFont;
  private bold!: PDFFont;
  private y = 0;
  private readonly width = A4[0] - MARGIN * 2;

  static async create(): Promise<PdfBuilder> {
    const b = new PdfBuilder();
    b.doc = await PDFDocument.create();

    const poppins = await loadPoppins();
    if (poppins) {
      b.doc.registerFontkit(fontkit);
      // subset:false - these PDFs are legal records that get printed and
      // re-opened in all sorts of viewers; a full embed is the safer bet.
      b.font = await b.doc.embedFont(poppins.regular);
      b.bold = await b.doc.embedFont(poppins.bold);
    } else {
      // Never fail a rental agreement over a font: fall back to the built-in.
      console.error("[pdf] Poppins assets unavailable: falling back to Helvetica");
      b.font = await b.doc.embedFont(StandardFonts.Helvetica);
      b.bold = await b.doc.embedFont(StandardFonts.HelveticaBold);
    }

    b.newPage();
    return b;
  }

  private newPage() {
    this.page = this.doc.addPage(A4);
    this.y = A4[1] - MARGIN;
  }

  private ensure(h: number) {
    if (this.y - h < MARGIN) this.newPage();
  }

  private wrap(text: string, size: number, font: PDFFont): string[] {
    const out: string[] = [];
    for (const raw of text.split("\n")) {
      const words = raw.split(/\s+/).filter(Boolean);
      if (words.length === 0) { out.push(""); continue; }
      let line = "";
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(test, size) > this.width && line) { out.push(line); line = w; }
        else line = test;
      }
      if (line) out.push(line);
    }
    return out;
  }

  title(text: string) {
    this.ensure(30);
    this.page.drawText(text, { x: MARGIN, y: this.y - 20, size: 20, font: this.bold, color: INK });
    this.y -= 30;
  }

  h2(text: string) {
    this.ensure(24);
    this.y -= 8;
    this.page.drawText(text, { x: MARGIN, y: this.y - 12, size: 12, font: this.bold, color: INK });
    this.y -= 18;
  }

  text(text: string, opts: { size?: number; muted?: boolean; gap?: number } = {}) {
    const size = opts.size ?? 9.5;
    const font = this.font;
    const lh = size + 3.5;
    for (const line of this.wrap(text, size, font)) {
      this.ensure(lh);
      if (line) this.page.drawText(line, { x: MARGIN, y: this.y - size, size, font, color: opts.muted ? MUTED : INK });
      this.y -= lh;
    }
    if (opts.gap) this.y -= opts.gap;
  }

  kv(key: string, value: string) {
    const size = 9.5, lh = size + 4;
    const keyW = 150;
    this.ensure(lh);
    this.page.drawText(key, { x: MARGIN, y: this.y - size, size, font: this.bold, color: INK });
    // wrap the value into the remaining width
    const vLines = this.wrapWidth(value, size, this.font, this.width - keyW);
    vLines.forEach((line, i) => {
      if (i > 0) this.ensure(lh);
      this.page.drawText(line, { x: MARGIN + keyW, y: this.y - size, size, font: this.font, color: INK });
      this.y -= lh;
    });
  }

  private wrapWidth(text: string, size: number, font: PDFFont, w: number): string[] {
    const out: string[] = []; let line = "";
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > w && line) { out.push(line); line = word; }
      else line = test;
    }
    if (line) out.push(line); else if (out.length === 0) out.push("");
    return out;
  }

  rule() {
    this.ensure(10); this.y -= 4;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: A4[0] - MARGIN, y: this.y }, thickness: 0.5, color: RULE });
    this.y -= 6;
  }

  space(n = 6) { this.y -= n; }

  async finish(): Promise<Uint8Array> {
    return this.doc.save();
  }
}
