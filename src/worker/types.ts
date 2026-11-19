export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  ENVIRONMENT: "local" | "staging" | "production";
  /** Tijdelijke afscherming tot de Microsoft-login er is (wrangler secret). */
  BASIC_AUTH_PASSWORD?: string;
};

export type AppEnv = {
  Bindings: Env;
  Variables: {
    /** Ingelogde gebruiker; null zolang de Microsoft-login er nog niet is. */
    userId: string | null;
  };
};
