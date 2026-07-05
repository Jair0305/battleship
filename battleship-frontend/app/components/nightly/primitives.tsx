import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { BackgroundCanvas } from "./BackgroundCanvas";

export type NightlyVariant = "primary" | "secondary" | "ghost" | "danger";
export type NightlyTone = "neutral" | "accent" | "success" | "warning" | "danger";
export type NightlySize = "sm" | "md" | "lg";

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
    <div className={cn("relative min-h-[100dvh] overflow-hidden bg-night text-night-text", className)}>
      <BackgroundCanvas />
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_82%_12%,rgba(185,249,90,0.13),transparent_28rem),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_18rem)]" />
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 opacity-[0.08] nightly-hairline" />
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
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#090909]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-4 px-4 md:px-6 lg:px-8">
        <div className="min-w-0">{brand ?? <NightlyBrandLink />}</div>
        <div className="hidden min-w-0 flex-1 justify-center md:flex">
          {status ?? (
            <div className="flex items-center gap-5">
              <GameBadge tone="accent">Public tables</GameBadge>
              {statusText && <span className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-night-faint">{statusText}</span>}
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
    <footer className="relative z-10 mx-auto flex w-full max-w-[1500px] flex-col gap-2 border-t border-white/10 px-4 py-6 text-xs uppercase tracking-[0.24em] text-night-faint md:flex-row md:items-center md:justify-between md:px-6 lg:px-8">
      <span>Nightly Games</span>
      <span className="font-mono normal-case tracking-normal">shared visual system v0.1</span>
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
    <section className="grid min-h-[calc(100dvh-120px)] items-center gap-8 py-8 lg:grid-cols-[1.08fr_0.92fr] lg:py-10">
      <div className="animate-night-fade-up">
        {eyebrow && <div className="mb-5">{eyebrow}</div>}
        <h1 className="max-w-4xl font-display text-5xl uppercase leading-[0.92] tracking-[-0.03em] text-night-text md:text-7xl lg:text-8xl">
          {title}
        </h1>
        {copy && <div className="mt-5 max-w-2xl text-sm leading-6 text-night-muted md:text-base">{copy}</div>}
        {stats && <div className="mt-8">{stats}</div>}
      </div>
      {children && <div className="animate-night-fade-up [animation-delay:90ms]">{children}</div>}
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
        <div className="flex flex-col gap-4 border-b border-white/10 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            {eyebrow && <div className="mb-2 text-xs uppercase tracking-[0.26em] text-night-accent">{eyebrow}</div>}
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
    <section className={cn("nightly-frame rounded-night p-4 md:p-5", toneClass(tone), className)}>
      {(title || eyebrow || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && <div className="mb-1 font-mono text-[0.65rem] uppercase tracking-[0.24em] text-night-faint">{eyebrow}</div>}
            {title && <h2 className="truncate font-display text-lg uppercase tracking-[0.02em] text-night-text">{title}</h2>}
          </div>
          {action}
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
        "rounded-night-sm border border-white/10 bg-[#10100e]/80 p-4 shadow-night-inner transition-all duration-200 ease-night",
        toneClass(tone),
        interactive && "hover:-translate-y-0.5 hover:border-night-accent/40 hover:bg-[#151611]",
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
    "inline-flex items-center justify-center gap-2 rounded-night-sm font-mono text-xs font-semibold uppercase tracking-[0.16em] transition-all duration-200 ease-night active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45",
    buttonSizeClass(size),
    variant === "primary" && "border border-night-accent/60 bg-night-accent text-[#111409] hover:bg-night-accent-strong",
    variant === "secondary" && "border border-white/10 bg-white/[0.06] text-night-text hover:border-night-accent/40 hover:bg-night-accent/10 hover:text-night-accent",
    variant === "ghost" && "border border-transparent bg-transparent text-night-muted hover:border-white/10 hover:bg-white/[0.04] hover:text-night-text",
    variant === "danger" && "border border-night-danger/50 bg-night-danger/10 text-[#ffdadd] hover:bg-night-danger/20",
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
    <span className={cn("inline-flex items-center rounded-night-sm border px-2.5 py-1 font-mono text-[0.68rem] uppercase tracking-[0.16em]", badgeToneClass(tone), className)}>
      {children}
    </span>
  );
}

export function GameScore({ label, value, tone = "accent" }: { label: ReactNode; value: ReactNode; tone?: NightlyTone }) {
  return (
    <div className="min-w-0 border-l border-white/10 pl-4">
      <div className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-night-faint">{label}</div>
      <div className={cn("mt-1 truncate font-mono text-xl font-semibold", scoreToneClass(tone))}>{value}</div>
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
    <div className={cn("rounded-night-sm border px-3 py-2", statusToneClass(tone), pulse && "animate-night-pulse")}>
      <div className="font-mono text-[0.64rem] uppercase tracking-[0.18em] opacity-70">{label}</div>
      <div className="mt-1 truncate font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}

export function GameOverlay({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("nightly-frame-strong nightly-scanline rounded-night p-5", className)}>{children}</div>;
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#090909]/80 px-4 backdrop-blur-md">
      <div className="nightly-frame-strong nightly-scanline w-full max-w-lg rounded-night p-6">
        <h2 className="font-display text-3xl uppercase text-night-text">{title}</h2>
        <div className="mt-4 text-sm leading-6 text-night-muted">{children}</div>
        {action && <div className="mt-6 flex flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  );
}

export function LoadingState({ title = "Cargando", body = "Sincronizando estado..." }: { title?: ReactNode; body?: ReactNode }) {
  return (
    <GamePanel className="relative min-h-48 overflow-hidden">
      <div className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-night-accent/10 to-transparent [animation:nightly-shimmer_1.6s_var(--night-ease)_infinite]" />
      <div className="relative grid min-h-40 place-items-center text-center">
        <div>
          <div className="font-display text-2xl uppercase text-night-text">{title}</div>
          <p className="mt-2 text-sm text-night-muted">{body}</p>
        </div>
      </div>
    </GamePanel>
  );
}

export function EmptyState({ title, body, action }: { title: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-night-sm border border-dashed border-white/10 bg-white/[0.025] p-5 text-center">
      <div className="font-display text-xl uppercase text-night-text">{title}</div>
      {body && <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-night-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Error", body }: { title?: ReactNode; body: ReactNode }) {
  return (
    <div className="rounded-night-sm border border-night-danger/30 bg-night-danger/10 p-4 text-sm text-[#ffdadd]">
      <span className="font-mono text-xs uppercase tracking-[0.18em]">{title}</span>
      <div className="mt-1">{body}</div>
    </div>
  );
}

export function PausedState({ body = "Partida pausada" }: { body?: ReactNode }) {
  return <GameOverlay><GameBadge tone="warning">Pausa</GameBadge><p className="mt-3 text-sm text-night-muted">{body}</p></GameOverlay>;
}

export function GameOverState({ title = "Game over", body, action }: { title?: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <GameOverlay>
      <GameBadge tone="danger">Fin de partida</GameBadge>
      <h2 className="mt-3 font-display text-3xl uppercase text-night-text">{title}</h2>
      {body && <p className="mt-2 text-sm leading-6 text-night-muted">{body}</p>}
      {action && <div className="mt-4 flex flex-wrap gap-2">{action}</div>}
    </GameOverlay>
  );
}

export function VictoryState({ title = "Victoria", body, action }: { title?: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <GameOverlay>
      <GameBadge tone="success">Resultado</GameBadge>
      <h2 className="mt-3 font-display text-3xl uppercase text-night-accent">{title}</h2>
      {body && <p className="mt-2 text-sm leading-6 text-night-muted">{body}</p>}
      {action && <div className="mt-4 flex flex-wrap gap-2">{action}</div>}
    </GameOverlay>
  );
}

export function NightlyBrandLink() {
  return (
    <Link href="/" className="group flex min-w-0 items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-night-sm border border-night-accent/40 bg-night-accent/10 font-display text-sm text-night-accent transition group-hover:bg-night-accent group-hover:text-[#111409]">
        NG
      </span>
      <span className="min-w-0">
        <span className="block truncate font-display text-xl uppercase leading-none tracking-[0.02em] text-night-text sm:hidden">Nightly</span>
        <span className="hidden truncate font-display text-xl uppercase leading-none tracking-[0.02em] text-night-text sm:block">Nightly Games</span>
        <span className="hidden font-mono text-[0.62rem] uppercase tracking-[0.22em] text-night-faint sm:block">Battleship table</span>
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
  return "";
}

function badgeToneClass(tone: NightlyTone) {
  if (tone === "accent") return "border-night-accent/30 bg-night-accent/10 text-night-accent";
  if (tone === "success") return "border-night-success/30 bg-night-success/10 text-night-success";
  if (tone === "warning") return "border-night-warning/30 bg-night-warning/10 text-night-warning";
  if (tone === "danger") return "border-night-danger/30 bg-night-danger/10 text-[#ffdadd]";
  return "border-white/10 bg-white/[0.04] text-night-muted";
}

function scoreToneClass(tone: NightlyTone) {
  if (tone === "success") return "text-night-success";
  if (tone === "warning") return "text-night-warning";
  if (tone === "danger") return "text-night-danger";
  if (tone === "neutral") return "text-night-text";
  return "text-night-accent";
}

function statusToneClass(tone: NightlyTone) {
  if (tone === "accent") return "border-night-accent/30 bg-night-accent/10 text-night-accent";
  if (tone === "success") return "border-night-success/30 bg-night-success/10 text-night-success";
  if (tone === "warning") return "border-night-warning/30 bg-night-warning/10 text-night-warning";
  if (tone === "danger") return "border-night-danger/30 bg-night-danger/10 text-[#ffdadd]";
  return "border-white/10 bg-white/[0.04] text-night-text";
}
