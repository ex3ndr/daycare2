import type { HTMLAttributes } from "react";

type PillTone = "neutral" | "accent" | "danger" | "success";

type PillProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: PillTone;
};

export function Pill({ className, tone = "neutral", ...props }: PillProps): JSX.Element {
  const classes = ["ui-pill", `ui-pill-${tone}`, className].filter(Boolean).join(" ");
  return <span className={classes} {...props} />;
}
