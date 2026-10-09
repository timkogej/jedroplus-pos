/**
 * A tiny in-memory stand-in for the Supabase client — just enough of the query
 * builder (select/insert/update/upsert + the filters this app uses) to run the
 * real business logic in tests without a database.
 */
type Row = Record<string, unknown>
type RpcHandler = (args: Record<string, unknown>) => { data: unknown; error: { message: string } | null }

let counter = 0
// Like a real database, hand back copies — never live references into the tables.
const copy = (rows: Row[]): Row[] => rows.map((r) => ({ ...r }))
const uid = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`

export interface FakeSupabase {
  tables: Record<string, Row[]>
  rpcCalls: Array<{ name: string; args: Record<string, unknown> }>
  uploads: string[]
  from(table: string): Query
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>
  storage: { from(bucket: string): { upload(path: string): Promise<{ error: null }>; getPublicUrl(path: string): { data: { publicUrl: string } }; createSignedUrl(path: string): Promise<{ data: { signedUrl: string }; error: null }> } }
  auth: unknown
}

type Filter = (r: Row) => boolean

class Query implements PromiseLike<{ data: unknown; error: { message: string; code?: string } | null; count?: number | null }> {
  private filters: Filter[] = []
  private limitN: number | null = null
  private mode: 'select' | 'insert' | 'update' | 'upsert' = 'select'
  private patch: Row | null = null
  private inserted: Row[] = []
  private head = false
  private countMode = false

  constructor(private db: FakeSupabase, private table: string, private hooks: FakeOptions) {}

  private rows(): Row[] {
    return (this.db.tables[this.table] ??= [])
  }

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.count) this.countMode = true
    if (opts?.head) this.head = true
    return this
  }
  eq(col: string, val: unknown) { this.filters.push((r) => r[col] === val); return this }
  neq(col: string, val: unknown) { this.filters.push((r) => r[col] !== val); return this }
  is(col: string, val: unknown) { this.filters.push((r) => (val === null ? r[col] == null : r[col] === val)); return this }
  in(col: string, vals: unknown[]) { this.filters.push((r) => vals.includes(r[col])); return this }
  not(col: string, op: string, val: unknown) {
    if (op === 'is' && val === null) this.filters.push((r) => r[col] != null)
    return this
  }
  gte(col: string, val: string) { this.filters.push((r) => String(r[col]) >= val); return this }
  lt(col: string, val: string) { this.filters.push((r) => String(r[col]) < val); return this }
  lte(col: string, val: string) { this.filters.push((r) => String(r[col]) <= val); return this }
  ilike(col: string, pattern: string) {
    const needle = pattern.replace(/\\([\\%_])/g, '$1').replace(/%/g, '').toLowerCase()
    this.filters.push((r) => String(r[col] ?? '').toLowerCase() === needle || (pattern.includes('%') && String(r[col] ?? '').toLowerCase().includes(needle)))
    return this
  }
  or(expr: string) {
    const parts = expr.split(',').map((p) => p.split('.'))
    this.filters.push((r) => parts.some(([col, op, ...rest]) => op === 'eq' && String(r[col]) === rest.join('.')))
    return this
  }
  order() { return this }
  limit(n: number) { this.limitN = n; return this }

  insert(data: Row | Row[]) {
    this.mode = 'insert'
    const list = Array.isArray(data) ? data : [data]
    this.inserted = list.map((d) => ({ id: uid(), created_at: new Date().toISOString(), ...d }))
    return this
  }
  update(patch: Row) { this.mode = 'update'; this.patch = patch; return this }
  upsert(data: Row | Row[], opts?: { onConflict?: string }) {
    this.mode = 'upsert'
    const list = Array.isArray(data) ? data : [data]
    this.inserted = list.map((d) => ({ id: uid(), ...d }))
    this.patch = { __onConflict: opts?.onConflict ?? 'id' }
    return this
  }

  private run(): { data: Row[] | null; error: { message: string; code?: string } | null; count: number | null } {
    const rows = this.rows()
    if (this.mode === 'insert') {
      const err = this.hooks.beforeInsert?.(this.table, this.inserted, this.db)
      if (err) return { data: null, error: err, count: null }
      rows.push(...this.inserted)
      return { data: copy(this.inserted), error: null, count: null }
    }
    if (this.mode === 'upsert') {
      const key = (this.patch as Row).__onConflict as string
      for (const d of this.inserted) {
        const existing = rows.find((r) => r[key] === d[key])
        if (existing) Object.assign(existing, d, { id: existing.id })
        else rows.push(d)
      }
      return { data: this.inserted, error: null, count: null }
    }
    let matched = rows.filter((r) => this.filters.every((f) => f(r)))
    if (this.mode === 'update') {
      matched.forEach((r) => Object.assign(r, this.patch))
      return { data: copy(matched), error: null, count: null }
    }
    if (this.limitN != null) matched = matched.slice(0, this.limitN)
    return { data: this.head ? null : copy(matched), error: null, count: this.countMode ? matched.length : null }
  }

  single() {
    const res = this.run()
    const first = res.data?.[0] ?? null
    return Promise.resolve({ data: first, error: first ? res.error : res.error ?? { message: 'no rows', code: 'PGRST116' } })
  }
  maybeSingle() {
    const res = this.run()
    return Promise.resolve({ data: res.data?.[0] ?? null, error: res.error })
  }
  then<T1, T2>(
    ok?: ((v: { data: unknown; error: { message: string; code?: string } | null; count?: number | null }) => T1 | PromiseLike<T1>) | null,
    fail?: ((e: unknown) => T2 | PromiseLike<T2>) | null
  ) {
    return Promise.resolve(this.run()).then(ok, fail)
  }
}

export interface FakeOptions {
  rpc?: Record<string, RpcHandler>
  /** Return an error to make an insert fail (e.g. unique violation). */
  beforeInsert?: (table: string, rows: Row[], db: FakeSupabase) => { message: string; code?: string } | null | undefined
}

export function createFakeSupabase(seed: Record<string, Row[]> = {}, hooks: FakeOptions = {}): FakeSupabase {
  const db: FakeSupabase = {
    tables: Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, v.map((r) => ({ ...r }))])),
    rpcCalls: [],
    uploads: [],
    from: (table) => new Query(db, table, hooks),
    rpc: async (name, args) => {
      db.rpcCalls.push({ name, args })
      const handler = hooks.rpc?.[name]
      if (handler) return handler(args)
      if (name === 'increment_invoice_counter' || name === 'increment_nonfiscal_counter') {
        return { data: db.rpcCalls.filter((c) => c.name === name).length, error: null }
      }
      return { data: null, error: null }
    },
    storage: {
      from: () => ({
        upload: async (path: string) => { db.uploads.push(path); return { error: null } },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/invoices/${path}` } }),
        createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://signed/${path}` }, error: null }),
      }),
    },
    auth: {},
  }
  return db
}
