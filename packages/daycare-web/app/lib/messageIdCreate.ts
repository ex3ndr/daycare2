import { createId } from "@paralleldrive/cuid2";

export function messageIdCreate(): string {
  return createId();
}
