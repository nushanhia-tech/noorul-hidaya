"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function HeroMedia({ images }: { images: { src: string; alt: string }[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (images.length < 2) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = setInterval(() => setI((n) => (n + 1) % images.length), 6500);
    return () => clearInterval(t);
  }, [images.length]);
  return (
    <div className="absolute inset-0">
      {images.map((img, n) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={img.src} src={img.src} alt={img.alt} fetchPriority={n === 0 ? "high" : "low"} loading={n === 0 ? "eager" : "lazy"}
          className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-1000", n === i ? "opacity-100" : "opacity-0")}
        />
      ))}
      {images.length > 1 && (
        <div className="absolute bottom-6 right-6 flex items-center gap-1.5" role="tablist" aria-label="Hero images">
          {images.map((img, n) => (
            <button
              key={img.src} type="button" role="tab" aria-selected={n === i} aria-label={`Show image ${n + 1}`} onClick={() => setI(n)}
              className={cn("h-1.5 rounded-full bg-white/90 transition-all", n === i ? "w-8" : "w-1.5 bg-white/60")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
