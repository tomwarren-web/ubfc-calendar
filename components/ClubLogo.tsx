"use client";

/* eslint-disable @next/next/no-img-element */

// Shows the club crest from public/logo.png, falling back to the placeholder
// SVG until the real logo file is added.
export default function ClubLogo({ className }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="UBFC crest"
      className={className}
      onError={(e) => {
        const img = e.currentTarget;
        if (!img.src.endsWith("/logo.svg")) img.src = "/logo.svg";
      }}
    />
  );
}
