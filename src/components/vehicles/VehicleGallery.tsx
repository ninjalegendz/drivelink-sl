"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Car, X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";

interface Props {
  photos: string[];
  alt: string;
}

export function VehicleGallery({ photos, alt }: Props) {
  const [active,    setActive]    = useState(0);
  const [zoomed,    setZoomed]    = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);          // 1 = fit, 2 = magnified (lightbox)
  const [pan,       setPan]       = useState({ x: 50, y: 50 }); // % position of zoom focus

  const touchStartX = useRef<number | null>(null);
  const didSwipe    = useRef(false);

  const next = () => setActive((i) => (i === photos.length - 1 ? 0 : i + 1));
  const prev = () => setActive((i) => (i === 0 ? photos.length - 1 : i - 1));

  // Reset pan + magnification when toggling zoom or switching image
  useEffect(() => { setPan({ x: 50, y: 50 }); setZoomLevel(1); }, [zoomed, active]);

  // Swipe left/right on the main image (touch). Sets didSwipe so the tap that
  // follows a swipe doesn't also open the lightbox.
  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX; didSwipe.current = false; }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || photos.length < 2) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) { didSwipe.current = true; if (dx < 0) next(); else prev(); }
    touchStartX.current = null;
  }

  // Lock body scroll while lightbox is open + Escape/arrow keys
  useEffect(() => {
    if (!zoomed) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape")     setZoomed(false);
      if (e.key === "ArrowLeft")  setActive((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setActive((i) => Math.min(photos.length - 1, i + 1));
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [zoomed, photos.length]);

  if (photos.length === 0) {
    return (
      <div className="rounded-2xl overflow-hidden bg-white aspect-[16/9] relative flex items-center justify-center text-slate-300">
        <Car size={64} strokeWidth={1.5} />
      </div>
    );
  }

  const main = photos[active];

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!zoomed || zoomLevel === 1) return; // only pan while magnified
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width)  * 100;
    const y = ((e.clientY - rect.top)  / rect.height) * 100;
    setPan({ x, y });
  }

  return (
    <>
      {/* Main image, tap to open lightbox; swipe or arrows step through inline */}
      <div
        className="rounded-2xl overflow-hidden bg-white aspect-[16/9] relative w-full group"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <button
          type="button"
          onClick={() => { if (didSwipe.current) { didSwipe.current = false; return; } setZoomed(true); }}
          className="absolute inset-0 cursor-zoom-in"
          aria-label="Zoom photo"
        >
          <Image
            src={main}
            alt={alt}
            fill
            className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            priority
            sizes="(max-width: 1024px) 100vw, 60vw"
          />
          {/* Visible by default on touch, hover-reveal on desktop */}
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 bg-black/60 text-white text-xs px-2 py-1 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <ZoomIn size={12} /> Tap to zoom
          </span>
        </button>

        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/55 hover:bg-black/75 text-white flex items-center justify-center backdrop-blur-sm transition md:opacity-0 md:group-hover:opacity-100 z-10"
              aria-label="Previous photo"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/55 hover:bg-black/75 text-white flex items-center justify-center backdrop-blur-sm transition md:opacity-0 md:group-hover:opacity-100 z-10"
              aria-label="Next photo"
            >
              <ChevronRight size={20} />
            </button>
            <span className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full pointer-events-none">
              {active + 1} / {photos.length}
            </span>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mt-3">
          {photos.map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={`relative w-24 h-16 shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
                i === active
                  ? "border-blue-500"
                  : "border-transparent hover:border-slate-300"
              }`}
              aria-label={`Show photo ${i + 1}`}
            >
              <Image src={url} alt={`Photo ${i + 1}`} fill className="object-cover" sizes="96px" />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setZoomed(false)}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setZoomed(false); }}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-900 flex items-center justify-center shadow-lg"
            aria-label="Close"
          >
            <X size={20} />
          </button>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setActive((i) => Math.max(0, i - 1)); }}
                disabled={active === 0}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-900 flex items-center justify-center shadow-lg disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Previous"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setActive((i) => Math.min(photos.length - 1, i + 1)); }}
                disabled={active === photos.length - 1}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-900 flex items-center justify-center shadow-lg disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Next"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          {/* Zoom canvas, starts fit-to-screen; tap/click toggles 2× magnify
              (pans with the cursor on desktop). Swipe changes photo when fit. */}
          <div
            className={`relative w-full h-full max-w-6xl max-h-[90vh] mx-4 overflow-hidden ${zoomLevel > 1 ? "cursor-zoom-out" : "cursor-zoom-in"}`}
            onClick={(e) => {
              e.stopPropagation();
              if (didSwipe.current) { didSwipe.current = false; return; }
              const rect = e.currentTarget.getBoundingClientRect();
              setPan({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 });
              setZoomLevel((z) => (z > 1 ? 1 : 2));
            }}
            onMouseMove={onMouseMove}
            onTouchStart={onTouchStart}
            onTouchEnd={(e) => { if (zoomLevel === 1) onTouchEnd(e); }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={main}
              alt={alt}
              className="absolute inset-0 w-full h-full object-contain transition-transform duration-150 select-none"
              style={{
                transform: `scale(${zoomLevel})`,
                transformOrigin: `${pan.x}% ${pan.y}%`,
              }}
              draggable={false}
            />
          </div>

          {photos.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-xs text-center px-4">
              {active + 1} / {photos.length}
            </div>
          )}
        </div>
      )}
    </>
  );
}
