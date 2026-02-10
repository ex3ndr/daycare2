import type { TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  tone?: "default" | "contrast";
};

export function Textarea({ className, tone = "default", ...props }: TextareaProps): JSX.Element {
  const classes = ["ui-textarea", `ui-textarea-${tone}`, className].filter(Boolean).join(" ");
  return <textarea className={classes} {...props} />;
}
