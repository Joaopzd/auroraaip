export function UsagePie({ pct, color, size = 56 }: { pct: number; color: string; size?: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const r = 15.9155; // circumference ≈ 100, so stroke-dasharray can use percentages directly
  const circumference = 2 * Math.PI * r;
  const dash = (clamped / 100) * circumference;

  return (
    <svg viewBox="0 0 36 36" width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx="18" cy="18" r={r} fill="none" strokeWidth="4" className="stroke-surface-elevated" />
      <circle
        cx="18" cy="18" r={r} fill="none" strokeWidth="4" strokeLinecap="round"
        stroke={color}
        strokeDasharray={`${dash} ${circumference - dash}`}
      />
    </svg>
  );
}
