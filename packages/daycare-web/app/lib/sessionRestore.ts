import type { ApiClient } from "@/app/daycare/api/apiClientCreate";
import type { Account, Organization } from "@/app/daycare/types";
import { sessionGet, sessionClear, type SessionData } from "./sessionStore";

export type SessionRestoreResult =
  | { status: "restored"; session: SessionData; account: Account; organizations: Organization[] }
  | { status: "none" }
  | { status: "expired" };

/**
 * On app load, read persisted session from localStorage and validate it
 * by calling GET /api/me. Returns the validated session with account data,
 * or clears the stored session if the token is expired/invalid.
 */
export async function sessionRestore(api: ApiClient): Promise<SessionRestoreResult> {
  const session = sessionGet();
  if (!session) {
    return { status: "none" };
  }

  try {
    const { account, organizations } = await api.meGet(session.token);
    return { status: "restored", session, account, organizations };
  } catch {
    sessionClear();
    return { status: "expired" };
  }
}
