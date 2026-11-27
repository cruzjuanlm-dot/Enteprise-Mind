type Field = {
  name: string;
  label: string;
  type?: "text" | "email";
  multiline?: boolean;
};

export function DisabledForm({
  id,
  title,
  note,
  submitLabel,
  fields,
}: {
  id: string;
  title: string;
  note: string;
  submitLabel: string;
  fields: Field[];
}) {
  return (
    <form id={id} className="form panel" aria-describedby={`${id}-note`}>
      <div className="stack-tight">
        <h2>{title}</h2>
        <p id={`${id}-note`}>{note}</p>
      </div>
      {fields.map((field) => (
        <div className="field" key={field.name}>
          <label htmlFor={`${id}-${field.name}`}>{field.label}</label>
          {field.multiline ? (
            <textarea id={`${id}-${field.name}`} name={field.name} disabled />
          ) : (
            <input
              id={`${id}-${field.name}`}
              name={field.name}
              type={field.type ?? "text"}
              disabled
            />
          )}
        </div>
      ))}
      <button type="submit" className="button" disabled>
        {submitLabel}
      </button>
    </form>
  );
}
