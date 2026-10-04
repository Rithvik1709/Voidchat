/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * A small in-memory stand-in for the parts of supabase-js the server routes use, so the API
 * rules can be tested for real (filters, inserts, deletes, rpc, storage) without a database.
 */
type Row = Record<string, any>;
type Result = { data: any; error: any; count?: number | null };

const toTime = (v: unknown) => (typeof v === 'string' ? Date.parse(v) : NaN);

/** Compare numbers numerically and ISO timestamps chronologically; anything else is "unknown". */
const compare = (a: unknown, b: unknown): number | null => {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const x = toTime(a), y = toTime(b);
  return Number.isNaN(x) || Number.isNaN(y) ? null : x - y;
};

class Query implements PromiseLike<Result> {
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private filters: ((r: Row) => boolean)[] = [];
  private payload: any;
  private wantsRows = true;
  private head = false;
  private count = false;
  private max: number | null = null;
  private singleMode: 'single' | 'maybe' | null = null;
  private sortSpec: { col: string; asc: boolean } | null = null;

  constructor(private db: FakeSupabase, private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op !== 'select') this.wantsRows = true; // insert/update/delete ... .select() returns rows
    this.head = Boolean(opts?.head);
    this.count = Boolean(opts?.count);
    return this;
  }
  insert(rows: Row | Row[]) { this.op = 'insert'; this.payload = Array.isArray(rows) ? rows : [rows]; this.wantsRows = false; return this; }
  update(obj: Row) { this.op = 'update'; this.payload = obj; this.wantsRows = false; return this; }
  delete() { this.op = 'delete'; this.wantsRows = false; return this; }

  eq(col: string, val: unknown) { this.filters.push(r => r[col] === val); return this; }
  neq(col: string, val: unknown) { this.filters.push(r => r[col] !== val); return this; }
  in(col: string, vals: unknown[]) { this.filters.push(r => vals.includes(r[col])); return this; }
  lt(col: string, val: string | number) { this.filters.push(r => (compare(r[col], val) ?? 1) < 0); return this; }
  lte(col: string, val: string | number) { this.filters.push(r => (compare(r[col], val) ?? 1) <= 0); return this; }
  gt(col: string, val: string | number) { this.filters.push(r => (compare(r[col], val) ?? -1) > 0); return this; }
  gte(col: string, val: string | number) { this.filters.push(r => (compare(r[col], val) ?? -1) >= 0); return this; }
  not(col: string, op: string, val: unknown) {
    if (op === 'is') this.filters.push(r => (val === null ? r[col] != null : r[col] !== val));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) { this.sortSpec = { col, asc: opts?.ascending !== false }; return this; }
  limit(n: number) { this.max = n; return this; }
  maybeSingle() { this.singleMode = 'maybe'; return this; }
  single() { this.singleMode = 'single'; return this; }

  then<T1 = Result, T2 = never>(res?: ((v: Result) => T1 | PromiseLike<T1>) | null, rej?: ((e: any) => T2 | PromiseLike<T2>) | null) {
    return Promise.resolve(this.execute()).then(res, rej);
  }

  private execute(): Result {
    if (this.db.missingTables.has(this.table)) {
      return { data: null, error: { code: 'PGRST205', message: `Could not find the table '${this.table}' in the schema cache` } };
    }
    const rows = this.db.tables[this.table] ?? (this.db.tables[this.table] = []);
    const matches = () => rows.filter(r => this.filters.every(f => f(r)));

    if (this.op === 'insert') {
      const created: Row[] = [];
      for (const input of this.payload as Row[]) {
        for (const col of Object.keys(input)) {
          if (this.db.missingColumns.has(col)) {
            return { data: null, error: { code: 'PGRST204', message: `Could not find the '${col}' column of '${this.table}' in the schema cache` } };
          }
        }
        // column defaults, like the real tables
        const defaults: Row = this.table === 'group_invites'
          ? { status: 'unused', claimed_at: null, claim_pub: null, claim_mac: null, delivery: null, used_at: null }
          : { last_active_at: new Date().toISOString(), active_user_count: 0 };
        const row: Row = {
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          ...defaults,
          ...input,
        };
        rows.push(row);
        created.push(row);
      }
      return this.finish(created);
    }

    if (this.op === 'update') {
      const hit = matches();
      hit.forEach(r => Object.assign(r, this.payload));
      return this.finish(hit);
    }

    if (this.op === 'delete') {
      const hit = matches();
      this.db.tables[this.table] = rows.filter(r => !hit.includes(r));
      if (this.table === 'groups') {
        const gone = new Set(hit.map(r => r.id));
        this.db.tables.group_invites = (this.db.tables.group_invites ?? []).filter(i => !gone.has(i.group_id));
      }
      return this.finish(hit);
    }

    let out = matches();
    if (this.sortSpec) {
      const { col, asc } = this.sortSpec;
      out = [...out].sort((a, b) => (a[col] > b[col] ? 1 : -1) * (asc ? 1 : -1));
    }
    const total = out.length;
    if (this.max !== null) out = out.slice(0, this.max);
    if (this.head) return { data: null, error: null, count: this.count ? total : null };
    return this.finish(out, total);
  }

  private finish(rows: Row[], total?: number): Result {
    // For writes, rows are only returned if .select() was chained.
    if (this.op !== 'select' && !this.wantsRows) return { data: this.singleMode ? this.pick(rows) : null, error: null };
    const picked = this.singleMode ? this.pick(rows) : rows.map(r => ({ ...r }));
    return { data: picked, error: null, count: total ?? null };
  }

  private pick(rows: Row[]) {
    if (rows.length === 0) return null;
    return { ...rows[0] };
  }
}

export class FakeSupabase {
  tables: Record<string, Row[]> = {};
  files: Record<string, { name: string; created_at: string }[]> = {}; // folder -> files
  missingColumns = new Set<string>();
  missingTables = new Set<string>();
  hasTryJoin = true;
  serviceRole = true; // is SUPABASE_SERVICE_ROLE_KEY configured?

  reset() {
    this.tables = { groups: [], site_visits: [], group_invites: [] };
    this.missingTables = new Set();
    this.files = {};
    this.missingColumns = new Set();
    this.hasTryJoin = true;
    this.serviceRole = true;
  }

  seedGroup(overrides: Row = {}): Row {
    const row: Row = {
      id: crypto.randomUUID(),
      name: 'test room',
      tags: [],
      creator_id: crypto.randomUUID(),
      active_user_count: 0,
      created_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      ...overrides,
    };
    (this.tables.groups ??= []).push(row);
    return row;
  }

  seedFile(folder: string, ageMs = 0, name = `${crypto.randomUUID()}.png`) {
    (this.files[folder] ??= []).push({ name, created_at: new Date(Date.now() - ageMs).toISOString() });
    return name;
  }

  from(table: string) { return new Query(this, table); }

  async rpc(name: string, args: { group_id: string }) {
    const group = (this.tables.groups ?? []).find(g => g.id === args.group_id);
    if (name === 'increment_active_users') {
      if (group) group.active_user_count = (group.active_user_count ?? 0) + 1;
      return { data: null, error: null };
    }
    if (name === 'decrement_active_users') {
      if (group) {
        group.active_user_count = Math.max(0, (group.active_user_count ?? 0) - 1);
        if (group.active_user_count <= 0) this.tables.groups = this.tables.groups.filter(g => g !== group);
      }
      return { data: null, error: null };
    }
    if (name === 'try_join_group') {
      if (!this.hasTryJoin) return { data: null, error: { code: 'PGRST202', message: 'function not found' } };
      if (!group) return { data: false, error: null };
      if (group.max_members != null && (group.active_user_count ?? 0) >= group.max_members) return { data: false, error: null };
      group.active_user_count = (group.active_user_count ?? 0) + 1;
      return { data: true, error: null };
    }
    return { data: null, error: { code: '42883', message: 'unknown function' } };
  }

  storage = {
    from: (_bucket: string) => ({
      list: async (prefix: string, opts?: { limit?: number }) => {
        if (prefix === '') {
          const folders = Object.keys(this.files).filter(f => this.files[f].length > 0);
          return { data: folders.slice(0, opts?.limit ?? 100).map(name => ({ name, id: null })), error: null };
        }
        const files = (this.files[prefix] ?? []).slice(0, opts?.limit ?? 100);
        return { data: files.map(f => ({ ...f, id: f.name, updated_at: f.created_at })), error: null };
      },
      remove: async (paths: string[]) => {
        for (const p of paths) {
          const [folder, ...rest] = p.split('/');
          const name = rest.join('/');
          this.files[folder] = (this.files[folder] ?? []).filter(f => f.name !== name);
        }
        return { data: paths, error: null };
      },
      upload: async (path: string) => {
        const [folder, ...rest] = path.split('/');
        (this.files[folder] ??= []).push({ name: rest.join('/'), created_at: new Date().toISOString() });
        return { data: { path }, error: null };
      },
      getPublicUrl: (path: string) => ({ data: { publicUrl: `http://localhost:54321/storage/v1/object/public/chat-images/${path}` } }),
    }),
  };
}
