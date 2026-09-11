"use client";

import { useState } from "react";

export function PhotoSlider({ photos, alt }: { photos: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  if (!photos.length) return null;
  const current = photos[index] ?? photos[0];

  function go(delta: number) {
    setIndex((i) => (i + delta + photos.length) % photos.length);
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-gold-500/15 bg-ink-900">
      <div className="relative flex min-h-[280px] items-center justify-center bg-ink-950 sm:min-h-[420px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current} alt={alt} className="max-h-[80vh] w-auto max-w-full object-contain p-2 sm:p-4" />
        {photos.length > 1 ? (
          <>
            <button
              type="button"
              className="absolute left-2 top-1/2 min-h-11 min-w-11 -translate-y-1/2 rounded-full bg-ink-950/80 text-2xl text-gold-300"
              onClick={() => go(-1)}
              aria-label="Previous photo"
            >
              ‹
            </button>
            <button
              type="button"
              className="absolute right-2 top-1/2 min-h-11 min-w-11 -translate-y-1/2 rounded-full bg-ink-950/80 text-2xl text-gold-300"
              onClick={() => go(1)}
              aria-label="Next photo"
            >
              ›
            </button>
          </>
        ) : null}
      </div>
      {photos.length > 1 ? (
        <div className="flex items-center justify-center gap-2 px-3 py-3">
          {photos.map((url, i) => (
            <button
              key={url}
              type="button"
              aria-label={`Photo ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-2.5 w-2.5 rounded-full ${i === index ? "bg-gold-400" : "bg-cream-200/30"}`}
            />
          ))}
          <span className="ml-2 text-xs text-cream-200/60">
            {index + 1}/{photos.length}
          </span>
        </div>
      ) : null}
    </div>
  );
}
