import type { HTMLAttributes } from "react";

type AvatarSize = "xs" | "sm" | "md" | "lg";
type AvatarTone = "neutral" | "accent" | "ghost";

type AvatarProps = HTMLAttributes<HTMLDivElement> & {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  tone?: AvatarTone;
};

const initialsFromName = (name: string): string => {
  const cleaned = name.trim();
  if (!cleaned) {
    return "?";
  }
  const parts = cleaned.split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return `${first}${second}`.toUpperCase();
};

export function Avatar({ name, src, size = "md", tone = "neutral", className, ...props }: AvatarProps): JSX.Element {
  const classes = ["ui-avatar", `ui-avatar-${size}`, `ui-avatar-${tone}`, className].filter(Boolean).join(" ");
  return (
    <div className={classes} aria-label={name} {...props}>
      {src ? <img src={src} alt={name} /> : <span>{initialsFromName(name)}</span>}
    </div>
  );
}
