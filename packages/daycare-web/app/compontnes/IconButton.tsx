import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonTone = "default" | "ghost" | "primary";
type IconButtonSize = "sm" | "md";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: IconButtonTone;
  size?: IconButtonSize;
  icon?: ReactNode;
};

export function IconButton({
  className,
  tone = "default",
  size = "md",
  icon,
  children,
  ...props
}: IconButtonProps): JSX.Element {
  const classes = ["ui-icon-button", `ui-icon-button-${tone}`, size === "sm" ? "ui-icon-button-sm" : null, className]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={classes} {...props}>
      {icon ?? children}
    </button>
  );
}
