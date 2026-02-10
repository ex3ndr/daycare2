import {
  createPersistentTokenGenerator,
  createPersistentTokenVerifier
} from "privacy-kit";

export type TokenClaims = {
  sessionId: string;
  extras: Record<string, unknown>;
};

export type TokenService = {
  issue: (sessionId: string, extras?: Record<string, unknown>) => Promise<string>;
  verify: (token: string) => Promise<TokenClaims | null>;
};

export async function tokenServiceCreate(service: string, seed: string): Promise<TokenService> {
  const generator = await createPersistentTokenGenerator({
    service,
    seed
  });

  const verifier = await createPersistentTokenVerifier({
    service,
    publicKey: generator.publicKey
  });

  return {
    issue: async (sessionId, extras = {}) => {
      return await generator.new({
        user: sessionId,
        extras
      });
    },
    verify: async (token) => {
      const verified = await verifier.verify(token);
      if (!verified?.user) {
        return null;
      }

      return {
        sessionId: verified.user,
        extras: verified.extras
      };
    }
  };
}
