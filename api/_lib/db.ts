/* ==========================================================================
   Database access for the MuseTools ledger
   --------------------------------------------------------------------------
   Production: Postgres over HTTP through the Neon serverless driver
               (DATABASE_URL — Neon, Vercel Postgres, or any Neon-compatible
               endpoint).
   Local:      an embedded Postgres (PGlite) in ./.data/pglite so `npm run dev`
               is a complete stack with no accounts. Never used on Vercel.

   Both expose the same `query(sql, params)` so the ledger has one code path.
   ========================================================================== */

export type Row = Record<string, unknown>;

export interface Db {
  query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  readonly backend: "postgres" | "pglite";
}

export class LedgerNotConfiguredError extends Error {
  constructor() {
    super("The ledger database is not configured. Set DATABASE_URL to a Postgres connection string.");
    this.name = "LedgerNotConfiguredError";
  }
}

let instance: Promise<Db> | null = null;

function isProduction() {
  return Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";
}

async function openPostgres(url: string): Promise<Db> {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(url);
  return {
    backend: "postgres",
    async query<T extends Row>(text: string, params: unknown[] = []) {
      return (await sql.query(text, params)) as T[];
    },
  };
}

async function openPglite(): Promise<Db> {
  /* The specifier is a variable so bundlers and Vercel's tracer do not ship
     the embedded Postgres (a large WASM) inside the serverless function. */
  const specifier = "@electric-sql/pglite";
  const mod = (await import(/* @vite-ignore */ specifier)) as typeof import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR || `${process.cwd()}/.data/pglite`;
  const { mkdirSync } = await import("node:fs");
  mkdirSync(dir, { recursive: true });
  const db = new mod.PGlite(dir);
  await db.waitReady;
  return {
    backend: "pglite",
    async query<T extends Row>(text: string, params: unknown[] = []) {
      const result = await db.query<T>(text, params);
      return result.rows;
    },
  };
}

export function ledgerConfigured() {
  return Boolean(process.env.DATABASE_URL) || !isProduction();
}

export function getDb(): Promise<Db> {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (url) instance = openPostgres(url);
    else if (isProduction()) return Promise.reject(new LedgerNotConfiguredError());
    else instance = openPglite();
    instance.catch(() => {
      instance = null;
    });
  }
  return instance;
}
