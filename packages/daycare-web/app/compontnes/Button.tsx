import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonProps): JSX.Element {
  const classes = ["ui-button", `ui-button-${variant}`, `ui-button-${size}`, className].filter(Boolean).join(" ");
  return <button className={classes} {...props} />;
}
