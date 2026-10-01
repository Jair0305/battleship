"use client";

// Fully static backdrop shared with Minesweeper's: CSS layers plus a few
// absolutely positioned nodes. No canvas, no animation frame, no listeners.

// Sonar contacts near the rings, anchored to the bottom-right corner (px).
const CONTACTS: Array<{ right: number; bottom: number; opacity: number }> = [
  { right: 214, bottom: 168, opacity: 0.45 },
  { right: 118, bottom: 302, opacity: 0.22 },
  { right: 352, bottom: 96, opacity: 0.18 },
];

export function BackgroundCanvas() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="nightly-background-grid absolute inset-0" />
      <div className="nightly-background-sonar -bottom-[260px] -right-[240px]" />
      <div className="nightly-background-sonar -left-[420px] -top-[460px] opacity-60" />
      {CONTACTS.map(({ right, bottom, opacity }) => (
        <span key={`${right}:${bottom}`} className="nightly-background-pip" style={{ right, bottom, opacity }} />
      ))}
      <div className="nightly-background-vignette absolute inset-0" />
    </div>
  );
}
