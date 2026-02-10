import type { HTMLAttributes, ReactNode } from "react";

type SectionHeaderProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
};

export function SectionHeader({ className, title, meta, action, ...props }: SectionHeaderProps): JSX.Element {
  const classes = ["ui-section-header", className].filter(Boolean).join(" ");
  return (
    <div className={classes} {...props}>
      <span className="ui-section-title">{title}</span>
      {meta ? <span className="ui-section-meta">{meta}</span> : null}
      {action ?? null}
    </div>
  );
}
