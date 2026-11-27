import type { ReadinessAxis } from "@/lib/hearthline";

const CX = 200;
const CY = 188;
const RADIUS = 112;

function point(index: number, radius: number): [number, number] {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / 5;
  return [CX + radius * Math.cos(angle), CY + radius * Math.sin(angle)];
}

function polygon(radius: number): string {
  return Array.from({ length: 5 }, (_, index) => point(index, radius).join(",")).join(" ");
}

export function ReadinessRadar({ axes }: { axes: ReadinessAxis[] }) {
  const data = axes
    .map((axis, index) => point(index, (axis.score / 5) * RADIUS).join(","))
    .join(" ");
  return (
    <svg className="radar" viewBox="-20 0 440 390" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((step) => (
        <polygon
          key={step}
          points={polygon((step / 5) * RADIUS)}
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="1"
        />
      ))}
      {axes.map((axis, index) => {
        const [x, y] = point(index, RADIUS);
        return <line key={axis.axis} x1={CX} y1={CY} x2={x} y2={y} stroke="#cbd5e1" />;
      })}
      <polygon points={data} fill="#ccfbf1" stroke="#0f766e" strokeWidth="2" />
      {axes.map((axis, index) => {
        const [x, y] = point(index, (axis.score / 5) * RADIUS);
        return <circle key={axis.axis} cx={x} cy={y} r="4" fill="#0f766e" />;
      })}
      {axes.map((axis, index) => {
        const angle = -Math.PI / 2 + (index * 2 * Math.PI) / 5;
        const [x, y] = point(index, RADIUS + 28);
        const cos = Math.cos(angle);
        const anchor = cos > 0.35 ? "start" : cos < -0.35 ? "end" : "middle";
        return (
          <text key={axis.axis} x={x} y={y} textAnchor={anchor} dominantBaseline="middle">
            {axis.axis}
          </text>
        );
      })}
      <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle" fill="#64748b" fontSize="12">
        0–5
      </text>
    </svg>
  );
}
