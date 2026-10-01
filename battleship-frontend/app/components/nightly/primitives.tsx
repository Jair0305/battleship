import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { BackgroundCanvas } from "./BackgroundCanvas";

export type NightlyVariant = "primary" | "secondary" | "ghost" | "danger";
export type NightlyTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "rival" | "signal";
export type NightlySize = "sm" | "md" | "lg";
export type NightlyOutcome = "win" | "loss" | "draw" | "neutral";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function GameShell({
  children,
  nav,
  footer,
  className,
}: {
  children: ReactNode;
  nav?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative min-h-[100dvh] overflow-x-clip bg-night text-night-text", className)}>
      <BackgroundCanvas />
      {nav}
      <main className="relative z-10 mx-auto w-full max-w-[1500px] px-4 py-5 md:px-6 lg:px-8">{children}</main>
      {footer}
    </div>
  );
}

export function GameNavbar({
  brand,
  status,
  statusText,
  children,
}: {
  brand?: ReactNode;
  status?: ReactNode;
  statusText?: string;
  children?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.09] bg-[#090909]/[0.94]">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-4 px-4 md:px-6 lg:px-8">
        <div className="min-w-0">{brand ?? <NightlyBrandLink />}</div>
        <div className="hidden min-w-0 flex-1 justify-center md:flex">
          {status ?? (
            <div className="flex items-center gap-4">
              <GameBadge tone="accent">Mesas publicas</GameBadge>
              {statusText && <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-night-faint">{statusText}</span>}
            </div>
          )}
        </div>
        <nav className="flex shrink-0 items-center gap-2">{children}</nav>
      </div>
    </header>
  );
}

export function GameFooter() {
  return (
    <footer className="relative z-10 mx-auto flex w-full max-w-[1500px] flex-col gap-2 border-t border-white/[0.08] px-4 py-6 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-night-faint md:flex-row md:items-center md:justify-between md:px-6 lg:px-8">
      <span>Nightly Games / Battleship</span>
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="h-1.5 w-1.5 bg-night-signal" />
        Clasico / 10x10
      </span>
    </footer>
  );
}

export function GameHero({
  eyebrow,
  title,
  copy,
  children,
  stats,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  copy?: ReactNode;
  children?: ReactNode;
  stats?: ReactNode;
}) {
  return (
    <section className="grid min-h-[calc(100dvh-140px)] items-center gap-8 py-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14 lg:py-10">
      <div className="animate-night-enter">
        {eyebrow && <div className="mb-5">{eyebrow}</div>}
        <h1 className="max-w-3xl font-display text-5xl uppercase leading-[0.95] text-night-text sm:text-6xl">
          {title}
        </h1>
        {copy && <div className="mt-5 max-w-xl text-sm leading-6 text-night-muted md:text-base md:leading-7">{copy}</div>}
        {stats && <div className="mt-8">{stats}</div>}
      </div>
      {children && <div className="nightly-pop">{children}</div>}
    </section>
  );
}

export function GameSection({
  title,
  eyebrow,
  description,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-5", className)}>
      {(title || eyebrow || description || action) && (
        <div className="flex flex-col gap-4 border-b border-white/[0.09] pb-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            {eyebrow && <div className="nightly-eyebrow mb-2 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-night-accent">{eyebrow}</div>}
            {title && <h2 className="font-display text-3xl uppercase leading-none text-night-text md:text-4xl">{title}</h2>}
            {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-night-muted">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function GamePanel({
  title,
  eyebrow,
  children,
  action,
  className,
  tone = "neutral",
}: {
  title?: ReactNode;
  eyebrow?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  tone?: NightlyTone;
}) {
  return (
    <section className={cn("nightly-frame rounded-night p-4 md:p-5", `nightly-tone-${tone}`, toneClass(tone), className)}>
      {(title || eyebrow || action) && (
        <div className="mb-4 flex min-w-0 items-start justify-between gap-3 border-b border-white/[0.07] pb-3">
          <div className="min-w-0">
            {eyebrow && <div className="nightly-eyebrow mb-1.5 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-night-faint">{eyebrow}</div>}
            {title && <h2 className="truncate font-display text-lg uppercase leading-tight text-night-text">{title}</h2>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function GameCard({
  children,
  className,
  interactive = false,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  tone?: NightlyTone;
}) {
  return (
    <article
      className={cn(
        "nightly-row rounded-night-sm border border-white/10 bg-[#10100e] p-4 shadow-night-inner",
        toneClass(tone),
        interactive && "hover:border-night-accent/40 hover:bg-[#141510]",
        className,
      )}
    >
      {children}
    </article>
  );
}

export function GameButton({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: NightlyVariant;
  size?: NightlySize;
}) {
  return (
    <button
      type={props.type ?? "button"}
      className={cn(gameButtonClassName(variant, size), className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function gameButtonClassName(variant: NightlyVariant = "primary", size: NightlySize = "md") {
  return cn(
    "nightly-button inline-flex min-h-9 items-center justify-center gap-2 rounded-night-sm border font-mono text-xs font-semibold uppercase tracking-[0.13em] disabled:cursor-not-allowed disabled:opacity-40",
    buttonSizeClass(size),
    variant === "primary" && "nightly-button-key border-night-accent/60 bg-night-accent text-night-accent-ink hover:bg-night-accent-strong",
    variant === "secondary" && "border-white/10 bg-[#171713] text-night-text shadow-night-inner hover:border-night-accent/45 hover:text-night-accent",
    variant === "ghost" && "border-transparent bg-transparent text-night-muted hover:border-white/10 hover:bg-white/[0.04] hover:text-night-text",
    variant === "danger" && "border-night-danger/45 bg-night-danger/10 text-[#ffdadd] hover:border-night-danger/70 hover:bg-night-danger/20",
  );
}

export function GameBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: NightlyTone;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-night-sm border px-2.5 py-1 font-mono text-[0.65rem] uppercase leading-none tracking-[0.14em]", badgeToneClass(tone), className)}>
      {children}
    </span>
  );
}

export function GameScore({ label, value, tone = "accent" }: { label: ReactNode; value: ReactNode; tone?: NightlyTone }) {
  return (
    <div className="min-w-0 border-l border-white/10 pl-4">
      <div className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-night-faint">{label}</div>
      <div className={cn("mt-1 truncate font-mono text-xl font-semibold tabular-nums", scoreToneClass(tone))}>{value}</div>
    </div>
  );
}

export function GameStatus({
  label,
  value,
  tone = "neutral",
  pulse = false,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: NightlyTone;
  pulse?: boolean;
}) {
  return (
    <div className={cn("relative min-w-0 overflow-hidden rounded-night-sm border px-3 py-2", statusToneClass(tone), pulse && "animate-night-pulse")}>
      <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-0.5", railToneClass(tone))} />
      <div className="font-mono text-[0.6rem] uppercase tracking-[0.16em] opacity-70">{label}</div>
      <div className="mt-1 truncate font-mono text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function GameOverlay({
  children,
  className,
  outcome,
}: {
  children: ReactNode;
  className?: string;
  outcome?: NightlyOutcome;
}) {
  return (
    <div className={cn("nightly-frame-strong rounded-night p-5", outcome ? "nightly-result" : "nightly-enter", className)} data-outcome={outcome}>
      {children}
    </div>
  );
}

export function GameModal({
  title,
  children,
  action,
}: {
  title: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="nightly-scrim fixed inset-0 z-50 grid place-items-center bg-[#060606]/85 px-4">
      <div className="nightly-frame-strong nightly-pop w-full max-w-lg rounded-night p-6">
        <h2 className="font-display text-3xl uppercase leading-tight text-night-text">{title}</h2>
        <div className="mt-4 text-sm leading-6 text-night-muted">{children}</div>
        {action && <div className="mt-6 flex flex-wrap gap-2 border-t border-white/[0.08] pt-4">{action}</div>}
      </div>
    </div>
  );
}

export function LoadingState({ title = "Cargando", body = "Sincronizando estado..." }: { title?: ReactNode; body?: ReactNode }) {
  return (
    <div className="nightly-frame nightly-ticks grid min-h-48 place-items-center rounded-night p-6 text-center" role="status">
      <div className="nightly-enter">
        <div className="nightly-loader mx-auto mb-4" aria-hidden="true"><span /><span /><span /><span /></div>
        <div className="font-display text-2xl uppercase text-night-text">{title}</div>
        <p className="mt-2 text-sm text-night-muted">{body}</p>
      </div>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-night-sm border border-dashed border-white/12 bg-white/[0.02] p-5 text-center">
      <div aria-hidden="true" className="mx-auto mb-3 grid w-max grid-cols-3 gap-[3px] opacity-60">
        <span className="h-1.5 w-1.5 bg-white/20" /><span className="h-1.5 w-1.5 bg-white/10" /><span className="h-1.5 w-1.5 bg-white/20" />
        <span className="h-1.5 w-1.5 bg-white/10" /><span className="h-1.5 w-1.5 bg-night-signal/70" /><span className="h-1.5 w-1.5 bg-white/10" />
      </div>
      <div className="font-display text-xl uppercase text-night-text">{title}</div>
      {body && <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-night-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Error", body }: { title?: ReactNode; body: ReactNode }) {
  return (
    <div role="alert" className="rounded-night-sm border border-l-2 border-night-danger/35 border-l-night-danger bg-[#1a0f10]/95 p-4 text-sm text-[#ffdadd]">
      <span className="font-mono text-xs uppercase tracking-[0.18em]">{title}</span>
      <div className="mt-1 leading-6">{body}</div>
    </div>
  );
}

export function PausedState({ body = "Partida pausada" }: { body?: ReactNode }) {
  return <GameOverlay><GameBadge tone="warning">Pausa</GameBadge><p className="mt-3 text-sm text-night-muted">{body}</p></GameOverlay>;
}

export function GameOverState({
  title = "Fin de partida",
  body,
  action,
  outcome = "loss",
}: {
  title?: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  outcome?: NightlyOutcome;
}) {
  return (
    <GameOverlay outcome={outcome}>
      <GameBadge tone={outcome === "loss" ? "danger" : "neutral"}>Fin de partida</GameBadge>
      <h2 className="nightly-result-title mt-3 font-display text-3xl uppercase text-night-text">{title}</h2>
      {body && <p className="mt-2 text-sm leading-6 text-night-muted">{body}</p>}
      {action && <div className="mt-4 flex flex-wrap gap-2">{action}</div>}
    </GameOverlay>
  );
}

export function VictoryState({ title = "Victoria", body, action }: { title?: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <GameOverlay outcome="win">
      <GameBadge tone="success">Resultado</GameBadge>
      <h2 className="nightly-result-title mt-3 font-display text-3xl uppercase text-night-accent">{title}</h2>
      {body && <p className="mt-2 text-sm leading-6 text-night-muted">{body}</p>}
      {action && <div className="mt-4 flex flex-wrap gap-2">{action}</div>}
    </GameOverlay>
  );
}

export function NightlyBrandLink() {
  return (
    <Link href="/" className="group flex min-w-0 items-center gap-3 rounded-night-sm">
      <span className="nightly-segment relative grid h-9 w-9 shrink-0 place-items-center rounded-night-sm border border-night-accent/40 bg-night-accent/10 font-display text-sm text-night-accent group-hover:bg-night-accent group-hover:text-night-accent-ink">
        NG
        <span aria-hidden="true" className="absolute -right-px -top-px h-1.5 w-1.5 bg-night-signal" />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-display text-xl uppercase leading-none text-night-text sm:hidden">Nightly</span>
        <span className="hidden truncate font-display text-xl uppercase leading-none text-night-text sm:block">Nightly Games</span>
        <span className="mt-1 hidden font-mono text-[0.58rem] uppercase tracking-[0.19em] text-night-faint sm:block">Battleship / mesa</span>
      </span>
    </Link>
  );
}

function buttonSizeClass(size: NightlySize) {
  if (size === "sm") return "px-2.5 py-1.5";
  if (size === "lg") return "px-5 py-3";
  return "px-3.5 py-2.5";
}

function toneClass(tone: NightlyTone) {
  if (tone === "accent") return "border-night-accent/25";
  if (tone === "success") return "border-night-success/25";
  if (tone === "warning") return "border-night-warning/25";
  if (tone === "danger") return "border-night-danger/25";
  if (tone === "info") return "border-night-info/25";
  if (tone === "rival") return "border-night-rival/25";
  if (tone === "signal") return "border-night-signal/25";
  return "";
}

function badgeToneClass(tone: NightlyTone) {
  if (tone === "accent") return "border-night-accent/30 bg-night-accent/10 text-night-accent";
  if (tone === "success") return "border-night-success/30 bg-night-success/10 text-night-success";
  if (tone === "warning") return "border-night-warning/30 bg-night-warning/10 text-night-warning";
  if (tone === "danger") return "border-night-danger/30 bg-night-danger/10 text-[#ffdadd]";
  if (tone === "info") return "border-night-info/30 bg-night-info/10 text-night-info";
  if (tone === "rival") return "border-night-rival/30 bg-night-rival/10 text-night-rival";
  if (tone === "signal") return "border-night-signal/30 bg-night-signal/10 text-night-signal";
  return "border-white/10 bg-white/[0.04] text-night-muted";
}

function scoreToneClass(tone: NightlyTone) {
  if (tone === "success") return "text-night-success";
  if (tone === "warning") return "text-night-warning";
  if (tone === "danger") return "text-night-danger";
  if (tone === "info") return "text-night-info";
  if (tone === "rival") return "text-night-rival";
  if (tone === "signal") return "text-night-signal";
  if (tone === "neutral") return "text-night-text";
  return "text-night-accent";
}

function statusToneClass(tone: NightlyTone) {
  if (tone === "neutral") return "border-white/[0.09] bg-[#10100e] text-night-text";
  return badgeToneClass(tone);
}

function railToneClass(tone: NightlyTone) {
  if (tone === "accent") return "bg-night-accent";
  if (tone === "success") return "bg-night-success";
  if (tone === "warning") return "bg-night-warning";
  if (tone === "danger") return "bg-night-danger";
  if (tone === "info") return "bg-night-info";
  if (tone === "rival") return "bg-night-rival";
  if (tone === "signal") return "bg-night-signal";
  return "bg-white/15";
}
