import type { StationId } from "@/lib/cycle";

const CX = 240;
const CY = 228;
const R = 128;

const ring: { id: StationId; deg: number; n: string }[] = [
  { id: "outside", deg: 0, n: "1" },
  { id: "pause", deg: 72, n: "2" },
  { id: "organized", deg: 144, n: "3" },
  { id: "session", deg: 216, n: "4" },
  { id: "value", deg: 288, n: "5" },
];

function polar(deg: number, radius: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return {
    x: Math.round((CX + radius * Math.sin(rad)) * 10) / 10,
    y: Math.round((CY - radius * Math.cos(rad)) * 10) / 10,
  };
}

function arc(start: number, end: number): string {
  let delta = end - start;
  if (delta < 0) delta += 360;
  const large = delta > 180 ? 1 : 0;
  const from = polar(start, R);
  const to = polar(end, R);
  return `M ${from.x} ${from.y} A ${R} ${R} 0 ${large} 1 ${to.x} ${to.y}`;
}

export function ValueCycleFigure({
  active,
  label,
}: {
  active: StationId | null;
  label?: string;
}) {
  const labelled = Boolean(label);
  const debtY = CY + 58;
  return (
    <svg
      className="cycle-svg"
      viewBox="20 36 440 400"
      role={labelled ? "img" : undefined}
      aria-hidden={labelled ? undefined : true}
      aria-label={label}
    >
      <path d={arc(90, 54)} fill="none" stroke="#0f766e" strokeWidth="2.5" />
      {[56, 88].map((deg) => {
        const inner = polar(deg, R - 16);
        const outer = polar(deg, R + 16);
        return (
          <line
            key={deg}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke="#0f766e"
            strokeWidth={active === "pause" ? 3 : 2}
          />
        );
      })}
      {active === "velocity" ? (
        <circle cx={CX} cy={CY - 6} r="52" fill="#ccfbf1" />
      ) : null}
      {active === "debt" ? (
        <rect x={CX - 118} y={debtY - 14} width="236" height="36" rx="6" fill="#fffbeb" />
      ) : null}
      <line
        x1={CX - 108}
        y1={debtY}
        x2={CX + 108}
        y2={debtY}
        stroke="#92400e"
        strokeWidth={active === "debt" ? 2.5 : 1.5}
      />
      <text className="cycle-debt" x={CX} y={debtY + 22} textAnchor="middle">
        Enterprise debt
      </text>
      <text className="cycle-center" x={CX} y={CY - 8} textAnchor="middle">
        Velocity
      </text>
      <text className="cycle-center-sub" x={CX} y={CY + 14} textAnchor="middle">
        days in the turn
      </text>
      {ring.map((node) => {
        const at = polar(node.deg, R);
        const numeral = polar(node.deg, R + 26);
        const on = active === node.id;
        if (node.id === "pause") {
          return (
            <g key={node.id}>
              <rect
                x={at.x - 8}
                y={at.y - 8}
                width="16"
                height="16"
                fill={on ? "#0f766e" : "#ffffff"}
                stroke="#0f766e"
                strokeWidth="2"
              />
              <text
                className={on ? "cycle-num is-active" : "cycle-num"}
                x={numeral.x}
                y={numeral.y}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {node.n}
              </text>
            </g>
          );
        }
        return (
          <g key={node.id}>
            <circle
              cx={at.x}
              cy={at.y}
              r={on ? 8 : 6}
              fill={on ? "#0f766e" : "#ffffff"}
              stroke="#0f766e"
              strokeWidth="2"
            />
            <text
              className={on ? "cycle-num is-active" : "cycle-num"}
              x={numeral.x}
              y={numeral.y}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {node.n}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
