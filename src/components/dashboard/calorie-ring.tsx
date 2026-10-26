/** Progress ring. Never hides overage: past 100% the ring turns amber and stays full. */
export function CalorieRing({ consumed, target, size = 168 }: { consumed: number; target: number; size?: number }) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = target > 0 ? consumed / target : 0;
  const over = ratio > 1;
  const dash = Math.min(1, Math.max(0, ratio)) * c;
  const remaining = Math.round(target - consumed);
  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(consumed)} of ${Math.round(target)} calories logged, ${Math.abs(remaining)} ${remaining >= 0 ? "remaining" : "over target"}`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          stroke={over ? "var(--warning)" : "var(--primary)"}
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-3xl font-semibold tabular-nums">{Math.abs(remaining).toLocaleString("en-IN")}</div>
        <div className="text-xs text-muted-foreground">kcal {remaining >= 0 ? "remaining" : "over"}</div>
      </div>
    </div>
  );
}
