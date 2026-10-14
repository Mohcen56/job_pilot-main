import { getPool } from "./pool";

const columns: Record<string, string[]> = {
  profiles: "id full_name email phone location current_title experience_level years_experience skills industries work_experience education job_titles_seeking remote_preference preferred_locations job_boards career_urls freshness_days salary_expectation cover_letter_tone linkedin_url portfolio_url work_authorization resume_pdf_url linkedin_context_id linkedin_connected is_complete created_at updated_at".split(" "),
  jobs: "id run_id user_id source source_board source_provider external_id canonical_apply_url published_at workplace_type geographic_eligibility experience_level seniority_match discovery_method discovery_url salary_min salary_max salary_currency match_status match_profile_hash source_url external_apply_url title company location salary job_type about_role responsibilities requirements nice_to_have benefits about_company match_score match_reason matched_skills missing_skills cover_letter tailored_resume_url tailored_match_score is_tailored company_research found_at".split(" "),
  career_sources: "id user_id career_url provider company_identifier discovery_method discovery_url last_fetched_at last_used_at jobs_cache cache_query created_at".split(" "),
  agent_runs: "id user_id status job_title_searched location_searched jobs_found started_at completed_at".split(" "),
  agent_logs: "id run_id user_id message level job_id created_at".split(" "),
  app_admins: ["user_id", "created_at"],
  ai_settings: ["id", "provider", "updated_by", "updated_at"],
};
const jsonColumns = new Set(["work_experience", "education", "company_research", "geographic_eligibility", "jobs_cache"]);
type Row = Record<string, unknown>;
type Result<T> = { data: T | null; error: { code: string; message: string } | null; count: number | null };

/** Internal repository. Every personal query is scoped independently of caller filters.
 * No query-builder or database endpoint is exposed to browsers. */
export class ScopedDatabase {
  constructor(private readonly userId: string) {}
  from(table: string): Query {
    if (!Object.hasOwn(columns, table)) throw new Error("Unknown table");
    return new Query(table, this.userId);
  }
}

class Query implements PromiseLike<Result<Row[]>> {
  private fields = "*";
  private operation: "select" | "insert" | "update" = "select";
  private records: Row[] = [];
  private filters: { column: string; operator: string; value: unknown }[] = [];
  private search?: { columns: string[]; value: string };
  private ordering: string[] = [];
  private offset = 0;
  private size?: number;
  private exactCount = false;
  constructor(private table: string, private userId: string) {}
  private column(name: string) {
    if (!columns[this.table].includes(name)) throw new Error("Unknown column");
    return `"${name}"`;
  }
  select(fields = "*", options?: { count?: string }) {
    this.fields = fields === "*" ? "*" : fields.split(",").map((v) => this.column(v.trim())).join(",");
    this.exactCount = options?.count === "exact";
    return this;
  }
  eq(column: string, value: unknown) { return this.filter(column, "=", value); }
  gte(column: string, value: unknown) { return this.filter(column, ">=", value); }
  lt(column: string, value: unknown) { return this.filter(column, "<", value); }
  private filter(column: string, operator: string, value: unknown) {
    this.column(column); this.filters.push({ column, operator, value }); return this;
  }
  not(column: string, operator: string, value: unknown) {
    if (operator !== "is" || value !== null) throw new Error("Unsupported filter");
    return this.filter(column, "IS NOT NULL", null);
  }
  searchText(fields: string[], value: string) {
    fields.forEach((field) => this.column(field)); this.search = { columns: fields, value }; return this;
  }
  order(column: string, options: { ascending: boolean; nullsFirst?: boolean }) {
    this.ordering.push(`${this.column(column)} ${options.ascending ? "ASC" : "DESC"} NULLS ${options.nullsFirst ? "FIRST" : "LAST"}`); return this;
  }
  limit(value: number) { if (!Number.isSafeInteger(value) || value < 1 || value > 1000) throw new Error("Invalid limit"); this.size = value; return this; }
  range(from: number, to: number) {
    if (!Number.isSafeInteger(from) || from < 0) throw new Error("Invalid offset");
    this.offset = from; return this.limit(to - from + 1);
  }
  update(value: Row) { this.operation = "update"; this.records = [value]; return this; }
  insert(values: Row[]) { this.operation = "insert"; this.records = values; return this; }
  async rows<T extends object>(): Promise<Result<T[]>> {
    return this.execute<T>();
  }
  async maybeSingle<T extends object = Row>(): Promise<Result<T>> {
    const result = await this.execute<T>();
    if ((result.data?.length ?? 0) > 1) return { data: null, error: { code: "MULTIPLE_ROWS", message: "Expected one row" }, count: null };
    return { ...result, data: result.data?.[0] ?? null };
  }
  async single<T extends object = Row>(): Promise<Result<T>> {
    const result = await this.maybeSingle<T>();
    return result.data ? result : { ...result, error: result.error ?? { code: "MISSING_ROW", message: "Row not found" } };
  }
  then<TResult1 = Result<Row[]>, TResult2 = never>(
    onfulfilled?: ((value: Result<Row[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> { return this.execute().then(onfulfilled, onrejected); }
  private async execute<T extends object = Row>(): Promise<Result<T[]>> {
    try {
      const values: unknown[] = [];
      const bind = (value: unknown) => { values.push(value); return `$${values.length}`; };
      const valueFor = (key: string, value: unknown) => jsonColumns.has(key) && value !== null ? JSON.stringify(value) : value;
      const owner = this.table === "profiles" ? "id" : "user_id";
      let where = "";
      if (this.operation !== "insert") {
      where = this.table === "ai_settings" ? '"id" = \'global\'' : `${this.column(owner)} = ${bind(this.userId)}`;
      if (this.table === "ai_settings" && this.operation === "update") {
        where += ` AND EXISTS (SELECT 1 FROM app_admins WHERE user_id = ${bind(this.userId)}::uuid)`;
      }
      for (const filter of this.filters) {
        where += ` AND ${this.column(filter.column)} ${filter.operator}${filter.operator === "IS NOT NULL" ? "" : " " + bind(filter.value)}`;
      }
      if (this.search) {
        const term = bind(`%${this.search.value.replace(/[\\%_]/g, "\\$&")}%`);
        where += ` AND (${this.search.columns.map((key) => `${this.column(key)} ILIKE ${term}`).join(" OR ")})`;
      }
      }
      let sql: string;
      if (this.operation === "select") {
        sql = `SELECT ${this.fields} FROM "${this.table}" WHERE ${where}`;
        if (this.ordering.length) sql += " ORDER BY " + this.ordering.join(",");
        if (this.size) sql += ` LIMIT ${this.size} OFFSET ${this.offset}`;
      } else {
        if (["app_admins", "profiles"].includes(this.table) && this.operation === "insert") throw new Error("Trusted provisioning required");
        if (this.table === "app_admins" || (this.table === "ai_settings" && this.operation === "insert")) throw new Error("Trusted provisioning required");
        const records = this.records.map((record) => {
          const row = { ...record };
          if (this.table === "ai_settings") {
            if (Object.keys(row).some((key) => !["provider", "updated_by"].includes(key))) throw new Error("Invalid settings write");
            row.updated_by = this.userId;
          } else if (this.operation === "insert") row[owner] = this.userId;
          else if (owner in row || "id" in row) throw new Error("Cannot change ownership");
          return row;
        });
        if (!records.length) throw new Error("Empty write");
        const keys = Object.keys(records[0]); keys.forEach((key) => this.column(key));
        if (this.operation === "update") {
          sql = `UPDATE "${this.table}" SET ${keys.map((key) => `${this.column(key)} = ${bind(valueFor(key, records[0][key]))}`).join(",")} WHERE ${where} RETURNING ${this.fields}`;
        } else {
          sql = `INSERT INTO "${this.table}" (${keys.map((key) => this.column(key)).join(",")}) VALUES ${records.map((row) => "(" + keys.map((key) => bind(valueFor(key, row[key]))).join(",") + ")").join(",")} RETURNING ${this.fields}`;
        }
      }
      // PostgreSQL returns the selected row shape requested by the repository caller.
      const result = await getPool().query<T & Row>(sql, values);
      let count: number | null = null;
      if (this.exactCount && this.operation === "select") {
        const countResult = await getPool().query(`SELECT count(*)::int AS count FROM "${this.table}" WHERE ${where}`, values);
        count = countResult.rows[0].count;
      }
      return { data: result.rows, error: null, count };
    } catch (error) {
      const code = (error as { code?: string }).code ?? "DATABASE_ERROR";
      console.error("[database] Query failed", this.table, code);
      return { data: null, error: { code, message: "Database operation failed" }, count: null };
    }
  }
}
