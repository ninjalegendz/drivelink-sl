"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Car, X, ChevronLeft, ChevronRight, Images } from "lucide-react";
import { Portal } from "@/components/ui/Portal";
import { useEscapeLayer } from "@/components/ui/useEscapeLayer";

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
  const scrollerRef = useRef<HTMLDivElement>(null); // mobile edge-to-edge carousel

  const next = () => setActive((i) => (i === photos.length - 1 ? 0 : i + 1));
  const prev = () => setActive((i) => (i === 0 ? photos.length - 1 : i - 1));

  function openLightboxAt(index: number) {
    setActive(index);
    setZoomed(true);
  }

  // Reset pan + magnification when toggling zoom or switching image
  useEffect(() => { setPan({ x: 50, y: 50 }); setZoomLevel(1); }, [zoomed, active]);

  // Keep the mobile carousel's scroll position matched to `active` once the
  // lightbox closes, so stepping through photos with the lightbox's own
  // arrows or the keyboard doesn't leave the carousel showing whatever photo
  // it had when the lightbox was opened.
  useEffect(() => {
    if (zoomed) return;
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollLeft = active * el.clientWidth;
  }, [zoomed, active]);

  // Swipe on the lightbox canvas (touch), only while it is not magnified,
  // dx > 40 steps to the next/previous photo. Sets didSwipe so the tap that
  // follows a swipe doesn't also toggle magnification.
  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX; didSwipe.current = false; }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || photos.length < 2) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) { didSwipe.current = true; if (dx < 0) next(); else prev(); }
    touchStartX.current = null;
  }

  // Which photo the mobile carousel is showing, read from native scroll
  // position, so the "1 / 5" pill and a tap-to-open-lightbox agree with what
  // is actually on screen.
  function onScroll() {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setActive(Math.min(photos.length - 1, Math.max(0, index)));
  }

  // Escape closes the viewer only (not the quick view it may sit in).
  useEscapeLayer(() => setZoomed(false), zoomed);

  // Lock body scroll while lightbox is open + arrow keys
  useEffect(() => {
    if (!zoomed) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
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
      <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden rounded-3xl bg-white text-slate-300 ring-1 ring-slate-900/[0.06]">
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

  // Bento grid: one large photo at 2/3 width, up to four smaller tiles in a
  // 2x2 grid filling the remaining 1/3. Fewer photos just means fewer small
  // tiles, and a single photo fills the whole frame.
  const smallTiles = photos.slice(1, 5);
  const hiddenCount = photos.length - 5;

  return (
    <>
      {/* Desktop bento grid */}
      <div className="relative hidden md:block">
        <div className="grid aspect-[16/9] grid-cols-3 grid-rows-2 gap-1 overflow-hidden rounded-3xl">
          <button
            type="button"
            onClick={() => openLightboxAt(0)}
            className={`group relative overflow-hidden ${smallTiles.length > 0 ? "col-span-2 row-span-2" : "col-span-3 row-span-2"}`}
            aria-label="Open full-screen photos"
          >
            <Image
              src={photos[0]}
              alt={alt}
              fill
              priority
              className="object-cover transition-[filter] duration-200 group-hover:brightness-90"
              sizes="(max-width: 1280px) 66vw, 800px"
            />
          </button>

          {smallTiles.length > 0 && (
            <div className="col-span-1 row-span-2 grid grid-cols-2 grid-rows-2 gap-1">
              {smallTiles.map((url, i) => {
                const index = i + 1;
                const isLastVisible = i === smallTiles.length - 1 && hiddenCount > 0;
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() => openLightboxAt(index)}
                    className="group relative overflow-hidden"
                    aria-label={isLastVisible ? `Open full-screen photos, ${hiddenCount} more` : `Open full-screen photos, photo ${index + 1}`}
                  >
                    <Image src={url} alt="" fill className="object-cover transition-[filter] duration-200 group-hover:brightness-90" sizes="17vw" />
                    {isLastVisible && (
                      <span className="absolute inset-0 flex items-center justify-center bg-slate-950/45 text-sm font-semibold text-white">
                        +{hiddenCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {photos.length > 1 && (
          <button
            type="button"
            onClick={() => openLightboxAt(active)}
            className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 shadow-md ring-1 ring-slate-900/[0.08] transition-colors hover:bg-slate-50"
          >
            <Images size={14} /> Show all photos
          </button>
        )}
      </div>

      {/* Mobile: edge-to-edge swipe carousel. Native scroll-snap, no custom
          swipe animation code to keep in sync with the browser's own. */}
      <div className="relative -mx-4 md:hidden">
        <div
          ref={scrollerRef}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none"
        >
          {photos.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => openLightboxAt(i)}
              className="relative aspect-[4/3] w-full shrink-0 snap-center"
              aria-label={`Photo ${i + 1} of ${photos.length}, open full-screen`}
            >
              <Image
                src={url}
                alt={i === 0 ? alt : ""}
                fill
                priority={i === 0}
                className="object-cover"
                sizes="100vw"
              />
            </button>
          ))}
        </div>
        {photos.length > 1 && (
          <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
            {active + 1} / {photos.length}
          </span>
        )}
      </div>

      {/* Lightbox: full-screen dark viewer. Tap/click toggles 2x magnify
          (pans with the cursor on desktop). Swipe changes photo when fit,
          and a thumbnail strip lets a desktop visitor jump straight to a
          photo instead of stepping one at a time. */}
      {zoomed && (
        // Portalled: inside the quick view this used to be trapped by the
        // dialog's own transform and only filled the dialog. See Portal.
        <Portal>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${alt}, photo viewer`}
          className="animate-fade-in fixed inset-0 z-[85] flex flex-col bg-slate-950/95 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] backdrop-blur-sm"
          onClick={() => setZoomed(false)}
        >
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            <span className="text-xs font-medium text-white/70">{active + 1} / {photos.length}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setZoomed(false); }}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-slate-900 shadow-lg hover:bg-white"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center">
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setActive((i) => Math.max(0, i - 1)); }}
                  disabled={active === 0}
                  className="absolute left-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-lg hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Previous"
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setActive((i) => Math.min(photos.length - 1, i + 1)); }}
                  disabled={active === photos.length - 1}
                  className="absolute right-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-lg hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Next"
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}

            {/* Zoom canvas, starts fit-to-screen; tap/click toggles 2x
                magnify (pans with the cursor on desktop). Swipe changes
                photo when fit. */}
            <div
              className={`relative mx-4 h-full w-full max-w-6xl overflow-hidden ${zoomLevel > 1 ? "cursor-zoom-out" : "cursor-zoom-in"}`}
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
                className="absolute inset-0 h-full w-full select-none object-contain transition-transform duration-150"
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: `${pan.x}% ${pan.y}%`,
                }}
                draggable={false}
              />
            </div>
          </div>

          {/* Thumbnail strip, desktop only: a phone screen is too narrow to
              spare for it, and swipe already covers browsing there. */}
          {photos.length > 1 && (
            <div className="hidden justify-center gap-2 overflow-x-auto p-4 md:flex" onClick={(e) => e.stopPropagation()}>
              {photos.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg ring-2 transition-colors ${
                    i === active ? "ring-blue-500" : "opacity-70 ring-transparent hover:opacity-100"
                  }`}
                  aria-label={`Show photo ${i + 1}`}
                >
                  <Image src={url} alt={`Photo ${i + 1}`} fill className="object-cover" sizes="80px" />
                </button>
              ))}
            </div>
          )}
        </div>
        </Portal>
      )}
    </>
  );
}
