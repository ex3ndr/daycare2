import type { ButtonHTMLAttributes, ReactNode } from "react";

type ListRowProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  active?: boolean;
};

export function ListRow({
  className,
  title,
  subtitle,
  leading,
  trailing,
  active = false,
  ...props
}: ListRowProps): JSX.Element {
  const classes = ["ui-list-row", active ? "ui-list-row-active" : null, className].filter(Boolean).join(" ");
  return (
    <button className={classes} {...props}>
      {leading ? <span className="ui-list-row-leading">{leading}</span> : null}
      <span className="ui-list-row-body">
        <span className="ui-list-row-title">{title}</span>
        {subtitle ? <span className="ui-list-row-subtitle">{subtitle}</span> : null}
      </span>
      {trailing ? <span className="ui-list-row-trailing">{trailing}</span> : null}
    </button>
  );
}
