import type { StationId } from "@/lib/cycle";

const VB_W = 720;
const VB_H = 560;
const CX = 360;
const CY = 286;
const R = 124;

const nodes: { id: StationId; name: string; deg: number; side: "top" | "right" | "left" }[] = [
  { id: "outside", name: "Outside knowledge", deg: 0, side: "top" },
  { id: "pause", name: "Big Pause", deg: 72, side: "right" },
  { id: "organized", name: "Organized", deg: 144, side: "right" },
  { id: "session", name: "Value session", deg: 216, side: "left" },
  { id: "value", name: "Actionable value", deg: 288, side: "left" },
];

const DEFAULT_CAPTION =
  "Value cycle. The ring runs from Outside knowledge, through a gap marked Big Pause, to Organized, Value session, and Actionable value. Velocity, in the center, is average days per cycle. Enterprise debt crosses the ring.";

function polar(deg: number, radius: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return {
    x: Math.round((CX + radius * Math.sin(rad)) * 10) / 10,
    y: Math.round((CY - radius * Math.cos(rad)) * 10) / 10,
  };
}

function arc(start: number, end: number): string {
  let delta = end - start;
  if (delta <= 0) delta += 360;
  const large = delta > 180 ? 1 : 0;
  const from = polar(start, R);
  const to = polar(end, R);
  return `M ${from.x} ${from.y} A ${R} ${R} 0 ${large} 1 ${to.x} ${to.y}`;
}

function place(deg: number, radius: number): { left: string; top: string } {
  const point = polar(deg, radius);
  return { left: `${(point.x / VB_W) * 100}%`, top: `${(point.y / VB_H) * 100}%` };
}

export function ValueCycleFigure({
  active = null,
  label = DEFAULT_CAPTION,
}: {
  active?: StationId | null;
  label?: string;
}) {
  const debt = place(180, 52);
  return (
    <figure className="cycle-figure">
      <div className="cycle-plot">
        <svg className="cycle-svg" viewBox={`0 0 ${VB_W} ${VB_H}`} aria-hidden="true">
          <path d={arc(88, 56)} fill="none" stroke="#0f766e" strokeWidth="3" strokeLinecap="round" />
          <line
            x1={CX - 72}
            y1={polar(180, 46).y}
            x2={CX + 72}
            y2={polar(180, 46).y}
            stroke="#92400e"
            strokeWidth={active === "debt" ? 2.5 : 1.5}
          />
          {nodes.map((node) => {
            const at = polar(node.deg, R);
            const on = active === node.id;
            return (
              <circle
                key={node.id}
                cx={at.x}
                cy={at.y}
                r={on ? 8 : 6}
                fill={on ? "#0f766e" : "#ffffff"}
                stroke="#0f766e"
                strokeWidth="2"
              />
            );
          })}
        </svg>
        <p className={`cycle-hub ${active === "velocity" ? "is-active" : ""}`} style={place(0, 0)}>
          <span className="cycle-hub-title">Velocity</span>
          <span className="meta">average days per cycle</span>
        </p>
        <p className={`cycle-debt-label ${active === "debt" ? "is-active" : ""}`} style={debt}>
          Enterprise debt
        </p>
        {nodes.map((node) => (
          <p
            key={node.id}
            className={`cycle-label side-${node.side} ${node.id === "pause" ? "is-pause" : ""} ${active === node.id ? "is-active" : ""}`}
            style={place(node.deg, R + 58)}
          >
            {node.name}
          </p>
        ))}
      </div>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}
