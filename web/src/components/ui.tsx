import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { FixtureRow } from "../../../shared/types";
import { onColor, ordinal, ratingColor, resultColor, shortDate } from "../lib";
import { tip } from "../glossary";

// ---------- tooltips ----------
// One listener for the whole app: any element with data-tip shows a tooltip on hover or keyboard focus.
// data-tip-title adds a heading. data-tip-overflow shows it only when the element's text is cut off.

type TipState = { title?: string; body: string; rect: DOMRect };

const cutOff = (el: HTMLElement) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;

export function Tooltips() {
  const [t, setT] = useState<TipState | null>(null);
  useEffect(() => {
    let current: HTMLElement | null = null;
    let timer: number | undefined;
    const hide = () => {
      current = null;
      clearTimeout(timer);
      setT(null);
    };
    const over = (e: Event) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>("[data-tip]") ?? null;
      if (el === current) return;
      hide();
      if (!el || !el.dataset.tip) return;
      if ("tipOverflow" in el.dataset && !cutOff(el)) return;
      current = el;
      timer = window.setTimeout(() => setT({ title: el.dataset.tipTitle, body: el.dataset.tip!, rect: el.getBoundingClientRect() }), e.type === "focusin" ? 0 : 160);
    };
    const out = (e: MouseEvent) => !e.relatedTarget && hide();
    document.addEventListener("mouseover", over);
    document.addEventListener("focusin", over);
    document.addEventListener("mouseout", out);
    document.addEventListener("pointerdown", hide);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("hashchange", hide);
    return () => {
      document.removeEventListener("mouseover", over);
      document.removeEventListener("focusin", over);
      document.removeEventListener("mouseout", out);
      document.removeEventListener("pointerdown", hide);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("hashchange", hide);
    };
  }, []);
  return t ? createPortal(<TipBox {...t} />, document.body) : null;
}

function TipBox({ title, body, rect }: TipState) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const box = ref.current!.getBoundingClientRect();
    const gap = 6;
    const above = rect.top - box.height - gap;
    const top = above >= 8 ? above : Math.min(rect.bottom + gap, innerHeight - box.height - 8);
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - box.width / 2, innerWidth - box.width - 8));
    setPos({ left, top });
  }, [rect]);
  return (
    <div
      ref={ref}
      role="tooltip"
     
      className="pointer-events-none fixed z-[70] max-w-[min(340px,calc(100vw-16px))] whitespace-pre-line rounded-lg border border-rule bg-terrace px-3 py-2 text-[14.5px] leading-snug text-chalk/90 shadow-xl"
      style={pos ?? { left: 0, top: 0, visibility: "hidden" }}
    >
      {title && <div className="mb-0.5 font-semibold text-chalk">{title}</div>}
      {body}
    </div>
  );
}

/** A glossary term: dotted underline, explainer on hover. */
export function Term({ k, extra, className = "", children }: { k: string; extra?: string; className?: string; children: ReactNode }) {
  return <span {...tip(k, extra)} tabIndex={0} className={`explain ${className}`}>{children}</span>;
}

/** Briefly highlights its content when the value changes within the same scope (a live update), never on first render. */
export function Flash({ value, scope, className = "", lift, children }: { value?: string; scope: string; className?: string; lift?: boolean; children?: ReactNode }) {
  const prev = useRef({ value, scope });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (prev.current.value !== value && prev.current.scope === scope && value) setN((x) => x + 1);
    prev.current = { value, scope };
  }, [value, scope]);
  return <span key={n} className={`${n ? (lift ? "flash goal-lift" : "flash") : ""} ${className}`}>{children ?? value}</span>;
}

/** Club crest with a quiet fallback. */
export function Crest({ src, className = "size-6", alt = "" }: { src?: string; className?: string; alt?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return <span className={`inline-block rounded-full bg-terrace ${className}`} aria-hidden />;
  return <img src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} className={`shrink-0 object-contain ${className}`} />;
}

export function Photo({ src, name, className = "", ring }: { src?: string; name: string; className?: string; ring?: string }) {
  const [broken, setBroken] = useState(false);
  const style = ring ? { boxShadow: `0 0 0 2px ${ring}` } : undefined;
  if (!src || broken) {
    const initials = name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("");
    return (
      <div className={`grid shrink-0 place-items-center rounded-full bg-terrace font-display font-bold text-mute ${className}`} style={style} aria-hidden>
        {initials}
      </div>
    );
  }
  return <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className={`shrink-0 rounded-full bg-terrace object-cover object-top ${className}`} style={style} />;
}

export function Rating({ value, className = "", big }: { value?: number; className?: string; big?: boolean }) {
  if (value == null || !isFinite(value) || value <= 0) return null;
  return (
    <span
      className={`inline-grid place-items-center rounded font-ui font-bold tnum text-[#0d1216] ${big ? "min-w-9 px-1.5 py-0.5 text-sm" : "min-w-7 px-1 text-[12px] leading-[16px]"} ${className}`}
      style={{ background: ratingColor(value) }}
      {...tip("rating")}
    >
      {value.toFixed(1)}
    </span>
  );
}

export function FormPills({ results, size = "md" }: { results: FixtureRow[]; size?: "sm" | "md" }) {
  return (
    <span className="inline-flex gap-[3px]" {...(results.length ? {} : {})}>
      {results.map((r) => (
        <span
          key={r.id}
          className={`grid place-items-center rounded-[3px] font-ui font-bold text-[#0d1216] ${size === "sm" ? "size-4 text-[11px]" : "size-[18px] text-[12px]"}`}
          style={{ background: resultColor(r.result) }}
          data-tip={`${r.result === "W" ? "Won" : r.result === "L" ? "Lost" : "Drew"} ${r.score} ${r.home ? "vs" : "at"} ${r.opponent.name}\n${r.comp} · ${shortDate(r.date)}`}
        >
          {r.result}
        </span>
      ))}
    </span>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 p-6 text-mute" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-mute border-t-transparent" />
      {label}
    </div>
  );
}

export function ErrorNote({ error, what }: { error: unknown; what: string }) {
  return (
    <div className="m-3 rounded-lg border border-red/40 bg-red/10 p-4 text-sm">
      Couldn't load {what}: {(error as Error)?.message ?? "unknown error"}. It retries automatically; reload if it persists.
    </div>
  );
}

export function Modal({ onClose, label, className = "", children }: { onClose: () => void; label: string; className?: string; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center sm:p-6" role="dialog" aria-modal="true" aria-label={label}>
      <button className="absolute inset-0 bg-black/70" onClick={onClose} aria-label="Close" />
      <div className={`modal-in relative flex h-full w-full flex-col overflow-hidden bg-night shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:rounded-2xl sm:border sm:border-rule ${className}`}>
        <button onClick={onClose} className="absolute right-3 top-3 z-10 rounded-full bg-black/50 px-3 py-1 text-sm hover:bg-black/70">
          Close
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Segmented<T extends string>({
  value, onChange, options, className = "", size = "md",
}: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; title?: string }[]; className?: string; size?: "sm" | "md" }) {
  return (
    <div className={`inline-flex rounded-lg bg-night/60 p-0.5 ring-1 ring-rule ${className}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          data-tip={o.title}
          className={`whitespace-nowrap rounded-md font-ui font-semibold transition-colors ${size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-[14.5px]"} ${o.value === value ? "bg-terrace text-chalk shadow" : "text-mute hover:text-chalk"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A small popover anchored to its trigger; closes on outside click or Escape. */
export function Popover({ trigger, children, align = "left", className = "" }: { trigger: (open: boolean) => ReactNode; children: ReactNode; align?: "left" | "right"; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      window.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="block text-left">
        {trigger(open)}
      </button>
      {open && (
        <div className={`pop-in absolute top-full z-40 mt-2 rounded-xl border border-rule bg-stand p-3 shadow-2xl ${align === "right" ? "right-0" : "left-0"} ${className}`}>
          {children}
        </div>
      )}
    </div>
  );
}

/** Section label inside panels: small, sentence case, muted. */
export function Label({ children, aside, className = "" }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-2 font-ui text-[13px] font-semibold text-mute ${className}`}>
      <span>{children}</span>
      {aside && <span className="font-normal">{aside}</span>}
    </div>
  );
}

/** League rank coloring: top quarter green, bottom quarter red. */
export function RankNote({ rank, of = 20, className = "" }: { rank?: number; of?: number; className?: string }) {
  if (!rank) return null;
  const q = Math.ceil(of / 4);
  const cls = rank <= q ? "text-good" : rank > of - q ? "text-bad" : "text-mute";
  return <span className={`font-ui text-[12px] tnum ${cls} ${className}`} data-tip={`${ordinal(rank)} of ${of} in the league`}>{ordinal(rank)}</span>;
}

export function Kit({ color, alt, number, size = 30, probable, className = "" }: { color: string; alt?: string; number?: string; size?: number; probable?: boolean; className?: string }) {
  const bg = `#${color.replace("#", "")}`;
  // Use the kit's second color for the number when it stands out from the shirt, else plain black/white.
  const second = alt ? `#${alt.replace("#", "")}` : undefined;
  const fg = second && onColor(second) !== onColor(bg) ? second : onColor(bg);
  return (
    <span
      className={`counter grid shrink-0 place-items-center rounded-full font-display font-extrabold leading-none tnum ${probable ? "counter-probable" : ""} ${className}`}
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.5, border: `2px solid ${second ?? "rgba(255,255,255,.35)"}` }}
    >
      {number}
    </span>
  );
}
