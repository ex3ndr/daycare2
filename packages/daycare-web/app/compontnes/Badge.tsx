import type { HTMLAttributes } from "react";

type BadgeTone = "neutral" | "accent" | "danger" | "success";
type BadgeSize = "sm" | "md";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  size?: BadgeSize;
};

export function Badge({ className, tone = "neutral", size = "md", ...props }: BadgeProps): JSX.Element {
  const classes = ["ui-badge", `ui-badge-${tone}`, size === "sm" ? "ui-badge-sm" : null, className]
    .filter(Boolean)
    .join(" ");
  return <span className={classes} {...props} />;
}
