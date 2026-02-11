const SESSION_KEY = "daycare:session";

export type SessionData = {
  token: string;
  accountId: string;
};

export function sessionGet(): SessionData | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.token === "string" &&
      typeof parsed.accountId === "string"
    ) {
      return { token: parsed.token, accountId: parsed.accountId };
    }
    return null;
  } catch {
    return null;
  }
}

export function sessionSet(data: SessionData): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

export function sessionClear(): void {
  localStorage.removeItem(SESSION_KEY);
}
