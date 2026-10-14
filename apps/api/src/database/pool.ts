import { Pool, types } from "pg";

// Keep API timestamps serializable and consistent with the frontend contracts.
types.setTypeParser(1184, (value) => new Date(value).toISOString());
types.setTypeParser(1114, (value) => new Date(value + "Z").toISOString());

let instance: Pool | undefined;
export function getPool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required. Follow the README database setup.");
  instance ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });
  return instance;
}
export async function closePool() {
  if (instance) await instance.end();
  instance = undefined;
}
