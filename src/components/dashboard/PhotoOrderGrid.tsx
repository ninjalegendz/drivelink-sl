"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Star, X } from "lucide-react";

export interface OrderablePhoto {
  /** Stable identity for React and for the reorder controls. */
  key: string;
  src: string;
  /** Picked on this device and not uploaded yet. */
  pending?: boolean;
}

interface Props {
  photos: OrderablePhoto[];
  /** Move the photo at `from` so it sits at `to`, shifting the rest along. */
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  className?: string;
}

/**
 * The photo strip, in the order renters will see it.
 *
 * The first photo is the cover, which made order matter while there was no way
 * to change it: the only fix was removing every photo and adding them back in
 * the right order. Three ways to reorder, because this is used on a phone as
 * often as a laptop:
 *
 *   - the arrows move a photo one place, and work by touch and by keyboard
 *   - the star sends a photo straight to the front, so making the eighth photo
 *     the cover is one tap rather than seven
 *   - dragging works where there is a mouse (HTML5 drag has no touch support,
 *     which is exactly why the arrows exist)
 */
export function PhotoOrderGrid({ photos, onMove, onRemove, className = "" }: Props) {
  const [draggingFrom, setDraggingFrom] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  if (photos.length === 0) return null;

  function handleDrop(to: number) {
    if (draggingFrom !== null && draggingFrom !== to) onMove(draggingFrom, to);
    setDraggingFrom(null);
    setDropTarget(null);
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((photo, i) => {
          const position = `${i + 1} of ${photos.length}`;
          return (
            <div
              key={photo.key}
              data-photo-key={photo.key}
              data-photo-index={i}
              draggable
              onDragStart={() => setDraggingFrom(i)}
              onDragEnd={() => { setDraggingFrom(null); setDropTarget(null); }}
              onDragOver={(e) => { e.preventDefault(); setDropTarget(i); }}
              onDragLeave={() => setDropTarget((t) => (t === i ? null : t))}
              onDrop={(e) => { e.preventDefault(); handleDrop(i); }}
              className={`relative overflow-hidden rounded-xl border bg-slate-100 transition-colors ${
                dropTarget === i && draggingFrom !== i ? "border-blue-500" : "border-slate-200"
              } ${draggingFrom === i ? "opacity-50" : ""}`}
            >
              <div className="relative aspect-square">
                {photo.pending ? (
                  // A freshly picked file is a blob: URL, which the image
                  // optimiser cannot fetch.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.src} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Image src={photo.src} alt="" fill className="object-cover" sizes="120px" />
                )}

                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => onMove(i, 0)}
                    title="Make this the cover photo"
                    aria-label={`Make photo ${position} the cover`}
                    className="absolute left-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-slate-900/70 text-white transition hover:bg-blue-600"
                  >
                    <Star size={13} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  aria-label={`Remove photo ${position}`}
                  className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-slate-900/70 text-white transition hover:bg-rose-500"
                >
                  <X size={13} />
                </button>

                {i === 0 && (
                  <span className="absolute bottom-1 left-1 rounded bg-blue-600 px-1.5 py-0.5 text-xs font-semibold text-white">
                    Cover
                  </span>
                )}
                {photo.pending && i !== 0 && (
                  <span className="absolute bottom-1 right-1 rounded bg-slate-900/80 px-1.5 py-0.5 text-xs text-blue-200">
                    New
                  </span>
                )}
              </div>

              <div className="flex border-t border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => onMove(i, i - 1)}
                  disabled={i === 0}
                  aria-label={`Move photo ${position} earlier`}
                  className="grid min-h-9 flex-1 place-items-center text-slate-600 transition hover:bg-slate-100 hover:text-blue-700 disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="w-px bg-slate-200" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => onMove(i, i + 1)}
                  disabled={i === photos.length - 1}
                  aria-label={`Move photo ${position} later`}
                  className="grid min-h-9 flex-1 place-items-center text-slate-600 transition hover:bg-slate-100 hover:text-blue-700 disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        The first photo is the cover renters see. Use the arrows to reorder, or the star to make a
        photo the cover. On a computer you can also drag a photo into place.
      </p>
    </div>
  );
}

/** Move one item inside a list, shifting the rest along. */
export function movePhotoInList<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
