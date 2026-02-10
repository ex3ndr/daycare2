import type { HTMLAttributes, ReactNode } from "react";

type FieldProps = HTMLAttributes<HTMLLabelElement> & {
  label: string;
  hint?: string;
  inline?: boolean;
  children: ReactNode;
};

export function Field({ className, label, hint, inline = false, children, ...props }: FieldProps): JSX.Element {
  const classes = ["ui-field", inline ? "ui-field-inline" : null, className].filter(Boolean).join(" ");
  return (
    <label className={classes} {...props}>
      <span className="ui-field-label">{label}</span>
      {children}
      {hint ? <span className="ui-field-hint">{hint}</span> : null}
    </label>
  );
}
