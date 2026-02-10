import type { HTMLAttributes } from "react";

type CardTone = "panel" | "surface" | "ghost";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  tone?: CardTone;
};

export function Card({ className, tone = "panel", ...props }: CardProps): JSX.Element {
  const classes = ["ui-card", `ui-card-${tone}`, className].filter(Boolean).join(" ");
  return <div className={classes} {...props} />;
}
