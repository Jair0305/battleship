"use client";

import { BOARD_SIZE, type CellShot } from "../../lib/types";
import { cn } from "../nightly/primitives";

const rows = Array.from({ length: BOARD_SIZE }, (_, index) => String.fromCharCode(65 + index));
const cols = Array.from({ length: BOARD_SIZE }, (_, index) => index + 1);

export type PlacementPreview = {
  cells: string[];
  valid: boolean;
  message: string | null;
};

export function PlacementBoard({
  ships,
  preview,
  onCellClick,
  onCellEnter,
  onCellLeave,
}: {
  ships: Record<string, string>;
  preview: PlacementPreview | null;
  onCellClick: (cell: string) => void;
  onCellEnter: (cell: string) => void;
  onCellLeave: () => void;
}) {
  const previewCells = new Set(preview?.cells ?? []);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="truncate font-display text-xl uppercase text-night-text">Tu flota</h3>
        <span className={preview?.valid === false ? "font-mono text-xs text-night-danger" : "font-mono text-xs text-night-faint"}>
          {preview?.message ?? "Click para colocar"}
        </span>
      </div>
      <BoardFrame>
        <div />
        {cols.map((col) => (
          <AxisLabel key={col}>{col}</AxisLabel>
        ))}
        {rows.map((row) => (
          <div key={row} className="contents">
            <AxisLabel>{row}</AxisLabel>
            {cols.map((col) => {
              const cell = `${row}${col}`;
              const hasShip = Boolean(ships[cell]);
              const inPreview = previewCells.has(cell);
              return (
                <button
                  key={cell}
                  type="button"
                  onClick={() => onCellClick(cell)}
                  onMouseEnter={() => onCellEnter(cell)}
                  onMouseLeave={onCellLeave}
                  aria-label={`Colocar barco en ${cell}`}
                  className={placementCellClassName(hasShip, inPreview, preview?.valid ?? true)}
                  title={cell}
                />
              );
            })}
          </div>
        ))}
      </BoardFrame>
    </div>
  );
}

export function BoardGrid({
  title,
  ships,
  shots,
  canShoot = false,
  disabledReason,
  onCellClick,
}: {
  title: string;
  ships: Record<string, string>;
  shots: Record<string, CellShot | undefined>;
  canShoot?: boolean;
  disabledReason?: string | null;
  onCellClick?: (cell: string) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="truncate font-display text-xl uppercase text-night-text">{title}</h3>
        {disabledReason && <span className="font-mono text-xs text-night-faint">{disabledReason}</span>}
      </div>
      <BoardFrame>
        <div />
        {cols.map((col) => (
          <AxisLabel key={col}>{col}</AxisLabel>
        ))}
        {rows.map((row) => (
          <div key={row} className="contents">
            <AxisLabel>{row}</AxisLabel>
            {cols.map((col) => {
              const cell = `${row}${col}`;
              const shot = shots[cell];
              const hasShip = Boolean(ships[cell]);
              const interactive = Boolean(canShoot && onCellClick && !shot);
              return (
                <button
                  key={cell}
                  type="button"
                  onClick={() => interactive && onCellClick?.(cell)}
                  disabled={!interactive}
                  aria-label={`${interactive ? "Disparar a" : "Celda"} ${cell}${hasShip ? ` con ${ships[cell]}` : ""}${shot ? ` resultado ${shot}` : ""}`}
                  title={`${cell}${hasShip ? ` - ${ships[cell]}` : ""}${shot ? ` - ${shot}` : ""}`}
                  data-interactive={interactive}
                  className={cellClassName(hasShip, shot)}
                >
                  {shot === "MISS" ? "." : shot === "HIT" ? "X" : shot === "SUNK" ? "!" : hasShip ? "" : ""}
                </button>
              );
            })}
          </div>
        ))}
      </BoardFrame>
    </div>
  );
}

function BoardFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-full overflow-x-auto pb-2">
      <div className="nightly-board grid w-max grid-cols-[28px_repeat(10,36px)] gap-1 rounded-night-sm p-2 md:grid-cols-[28px_repeat(10,40px)]">
        {children}
      </div>
    </div>
  );
}

function AxisLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-9 items-center justify-center font-mono text-[0.68rem] text-night-faint md:h-10">
      {children}
    </div>
  );
}

function cellClassName(hasShip: boolean, shot: CellShot | undefined) {
  return cn(
    "nightly-cell md:h-10 md:w-10",
    shot === "MISS" && "nightly-cell-miss",
    shot === "HIT" && "nightly-cell-hit",
    shot === "SUNK" && "nightly-cell-sunk",
    !shot && hasShip && "nightly-cell-ship",
  );
}

function placementCellClassName(hasShip: boolean, inPreview: boolean, previewValid: boolean) {
  return cn(
    "nightly-cell md:h-10 md:w-10 cursor-crosshair",
    inPreview && previewValid && "border-night-success/70 bg-night-success/25",
    inPreview && !previewValid && "border-night-danger/70 bg-night-danger/25",
    !inPreview && hasShip && "nightly-cell-ship",
  );
}
