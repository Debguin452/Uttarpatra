/**
 * Custom icon set — 24x24 grid, 1.5px stroke, round joins, currentColor.
 * Deliberately not pulled from Lucide/Feather/Heroicons: drawn for this
 * brief (a mark-sheet / instrument feel) and kept to the five bottom-nav
 * icons plus the handful used in the home screen. No emoji anywhere.
 */
import type { JSX } from "preact";

type IconProps = { size?: number; strokeWidth?: number; className?: string };
const base = (size = 24) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": "true" as const,
});

export function IconHome({ size, strokeWidth = 1.5, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth} className={className}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function IconBatches({ size, strokeWidth = 1.5, className }: IconProps): JSX.Element {
  // Stacked panels — reads as "layers of a syllabus" rather than a generic folder.
  return (
    <svg {...base(size)} strokeWidth={strokeWidth} className={className}>
      <rect x="4.5" y="4.5" width="15" height="4.5" rx="1" />
      <rect x="4.5" y="10.5" width="15" height="4.5" rx="1" />
      <rect x="4.5" y="16.5" width="10" height="3" rx="1" />
    </svg>
  );
}

export function IconTest({ size, strokeWidth = 1.5, className }: IconProps): JSX.Element {
  // An OMR-sheet mark — bubbles and a filled answer, not a generic checklist.
  return (
    <svg {...base(size)} strokeWidth={strokeWidth} className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="9" cy="9.5" r="1.4" />
      <circle cx="9" cy="14.5" r="1.4" fill="currentColor" stroke="none" />
      <line x1="13" y1="9.5" x2="17.5" y2="9.5" />
      <line x1="13" y1="14.5" x2="17.5" y2="14.5" />
    </svg>
  );
}

export function IconDoubt({ size, strokeWidth = 1.5, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth} className={className}>
      <path d="M4.5 6.5h15v9h-8l-4 3.2v-3.2h-3z" />
      <path d="M9.6 10.2c0-1.1.9-1.8 2-1.8s1.9.6 1.9 1.5c0 1.3-1.9 1.3-1.9 2.6" />
      <circle cx="11.6" cy="14.4" r="0.15" fill="currentColor" />
    </svg>
  );
}

export function IconProfile({ size, strokeWidth = 1.5, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth} className={className}>
      <circle cx="12" cy="8.3" r="3.3" />
      <path d="M5.5 19.5c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5" />
    </svg>
  );
}

export function IconPlay({ size, strokeWidth = 1.5, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10.3 9v6l5-3z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconChevronRight({ size, strokeWidth = 1.5, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth} className={className}>
      <path d="M9.5 5.5 16 12l-6.5 6.5" />
    </svg>
  );
}

export function IconSearch({ size, strokeWidth = 1.5, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth} className={className}>
      <circle cx="10.5" cy="10.5" r="6" />
      <line x1="15" y1="15" x2="19.5" y2="19.5" />
    </svg>
  );
}

export function IconBell({ size, strokeWidth = 1.5, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth} className={className}>
      <path d="M6 16v-4.5a6 6 0 0 1 12 0V16l1.5 2h-15z" />
      <path d="M10 19.5a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function IconStreak({ size, strokeWidth = 1.5, className }: IconProps): JSX.Element {
  // Ascending bars — progress over time, not a flame.
  return (
    <svg {...base(size)} strokeWidth={strokeWidth} className={className}>
      <line x1="5.5" y1="18.5" x2="5.5" y2="14" />
      <line x1="10.5" y1="18.5" x2="10.5" y2="10" />
      <line x1="15.5" y1="18.5" x2="15.5" y2="6.5" />
      <path d="M4.5 10.5 10 6l3 2.5 5-5" />
    </svg>
  );
}

export function IconLock({ size, strokeWidth = 1.5, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth} className={className}>
      <rect x="5.5" y="11" width="13" height="9" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function IconClock({ size, strokeWidth = 1.5, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.2 2" />
    </svg>
  );
}
