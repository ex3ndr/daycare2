import type { ReactNode } from "react";

type NavProps = {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
};

export function Nav({ title, subtitle, left, right }: NavProps): JSX.Element {
  return (
    <header className="ui-nav">
      <div className="ui-nav-left">
        {left ?? null}
        <div>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      <div className="ui-nav-right">{right ?? null}</div>
    </header>
  );
}
