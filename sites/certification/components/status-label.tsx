const tones = {
  info: "status status-info",
  success: "status status-success",
  warning: "status status-warning",
  danger: "status status-danger",
  neutral: "status status-neutral",
  final: "status status-final",
} as const;

export function StatusLabel({
  tone,
  children,
}: {
  tone: keyof typeof tones;
  children: string;
}) {
  return <span className={tones[tone]}>{children}</span>;
}
