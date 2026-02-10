import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  tone?: "default" | "contrast";
};

export function Input({ className, tone = "default", ...props }: InputProps): JSX.Element {
  const classes = ["ui-input", `ui-input-${tone}`, className].filter(Boolean).join(" ");
  return <input className={classes} {...props} />;
}
