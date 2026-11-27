export function PageHeader({
  kicker,
  title,
  lede,
  monoTitle = false,
}: {
  kicker?: string;
  title: string;
  lede?: string;
  monoTitle?: boolean;
}) {
  return (
    <header className="page-header">
      {kicker ? <p className="kicker">{kicker}</p> : null}
      <h1 className={monoTitle ? "id-title" : undefined}>{title}</h1>
      {lede ? <p className="lede">{lede}</p> : null}
    </header>
  );
}
