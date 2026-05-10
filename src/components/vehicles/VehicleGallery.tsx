"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Car, X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";

interface Props {
  photos: string[];
  alt: string;
}

export function VehicleGallery({ photos, alt }: Props) {
  const [active,  setActive]  = useState(0);
  const [zoomed,  setZoomed]  = useState(false);
  const [pan,     setPan]     = useState({ x: 50, y: 50 }); // % position of zoom focus

  // Reset pan when toggling zoom or switching image
  useEffect(() => { setPan({ x: 50, y: 50 }); }, [zoomed, active]);

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
      <div className="rounded-2xl overflow-hidden bg-slate-900 aspect-[16/9] relative flex items-center justify-center text-slate-700">
        <Car size={64} strokeWidth={1.5} />
      </div>
    );
  }

  const main = photos[active];

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!zoomed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width)  * 100;
    const y = ((e.clientY - rect.top)  / rect.height) * 100;
    setPan({ x, y });
  }

  return (
    <>
      {/* Main image — click to open lightbox */}
      <button
        type="button"
        onClick={() => setZoomed(true)}
        className="rounded-2xl overflow-hidden bg-slate-900 aspect-[16/9] relative w-full block group cursor-zoom-in"
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
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 bg-black/60 text-white text-xs px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
          <ZoomIn size={12} /> Zoom
        </span>
        {photos.length > 1 && (
          <span className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
            {active + 1} / {photos.length}
          </span>
        )}
      </button>

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
                  ? "border-amber-500"
                  : "border-transparent hover:border-slate-600"
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
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white flex items-center justify-center"
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
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Previous"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setActive((i) => Math.min(photos.length - 1, i + 1)); }}
                disabled={active === photos.length - 1}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Next"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          {/* Zoom canvas — pans with cursor when zoomed in */}
          <div
            className="relative w-full h-full max-w-6xl max-h-[90vh] mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onMouseMove={onMouseMove}
            onMouseLeave={() => setPan({ x: 50, y: 50 })}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={main}
              alt={alt}
              className="absolute inset-0 w-full h-full object-contain transition-transform duration-150 select-none"
              style={{
                transform: `scale(2)`,
                transformOrigin: `${pan.x}% ${pan.y}%`,
              }}
              draggable={false}
            />
          </div>

          {photos.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-xs">
              {active + 1} / {photos.length} · use ← / → keys
            </div>
          )}
        </div>
      )}
    </>
  );
}
