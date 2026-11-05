/**
 * Customer persistence.
 *
 * The UI talks to one `CustomerRepo`. Two implementations sit behind it:
 *  - LocalRepo: browser storage, used for the guest/demo session and whenever
 *    no Supabase project is configured.
 *  - SupabaseRepo: Postgres rows protected by Row Level Security (see
 *    supabase/schema.sql), used for real accounts.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanId } from "./ledger";
import { CUSTOMER_SEED, type Customer, type CustomerStatus, type Invoice } from "./model";

export interface CustomerRepo {
  list(): Promise<Customer[]>;
  add(customer: Customer): Promise<void>;
  update(id: string, patch: Partial<Pick<Customer, "status" | "plan" | "seats">>): Promise<void>;
  remove(id: string): Promise<void>;
}

/** Minimal key/value surface so tests can pass an in-memory store. */
export type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/* -------------------------------------------------------------------------- */

export class LocalRepo implements CustomerRepo {
  private readonly key: string;

  constructor(
    scope: string,
    private readonly store: KeyValueStore = window.localStorage,
  ) {
    this.key = `lumen:customers:v1:${scope}`;
  }

  private read(): Customer[] | null {
    try {
      const raw = this.store.getItem(this.key);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Customer[]) : null;
    } catch {
      return null; // corrupted or blocked storage: start from the seed
    }
  }

  private write(customers: Customer[]) {
    try {
      this.store.setItem(this.key, JSON.stringify(customers));
    } catch {
      /* private mode or quota: the session still works in memory */
    }
  }

  /** Forget local changes; the next `list()` restores the sample workspace. */
  clear() {
    try {
      this.store.removeItem(this.key);
    } catch {
      /* nothing to clear */
    }
  }

  async list() {
    const existing = this.read();
    if (existing) return existing;
    this.write(CUSTOMER_SEED);
    return CUSTOMER_SEED;
  }

  async add(customer: Customer) {
    this.write([customer, ...(this.read() ?? CUSTOMER_SEED)]);
  }

  async update(id: string, patch: Parameters<CustomerRepo["update"]>[1]) {
    this.write((this.read() ?? CUSTOMER_SEED).map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async remove(id: string) {
    this.write((this.read() ?? CUSTOMER_SEED).filter((c) => c.id !== id));
  }
}

/* -------------------------------------------------------------------------- */

export type CustomerRow = {
  id: string;
  name: string;
  email: string;
  plan: PlanId;
  status: CustomerStatus;
  seats: number;
  tokens: number;
  joined: string;
  last_active: string;
  location: string;
  tint: string;
  invoices: Invoice[] | null;
};

export const toRow = (c: Customer): CustomerRow => ({
  id: c.id,
  name: c.name,
  email: c.email,
  plan: c.plan,
  status: c.status,
  seats: c.seats,
  tokens: c.tokens,
  joined: c.joined,
  last_active: c.lastActive,
  location: c.location,
  tint: c.tint,
  invoices: c.invoices,
});

export const fromRow = (r: CustomerRow): Customer => ({
  id: r.id,
  name: r.name,
  email: r.email,
  plan: r.plan,
  status: r.status,
  seats: r.seats,
  tokens: r.tokens,
  joined: r.joined,
  lastActive: r.last_active,
  location: r.location,
  tint: r.tint,
  invoices: r.invoices ?? [],
});

export class SupabaseRepo implements CustomerRepo {
  constructor(private readonly db: SupabaseClient) {}

  private loading: Promise<Customer[]> | null = null;

  /** Concurrent callers (StrictMode, a quick remount) share one load, so the seed is never raced. */
  list() {
    this.loading ??= this.load().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  private async load() {
    const { data, error } = await this.db
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (data.length > 0) return (data as CustomerRow[]).map(fromRow);

    // First sign-in: give the account the sample workspace so it is never empty.
    // The unique (owner_id, email) index plus ignoreDuplicates makes this idempotent,
    // even if two tabs get here at the same moment.
    const { data: auth } = await this.db.auth.getSession();
    const owner = auth.session?.user.id;
    if (!owner) throw new Error("Not signed in");
    const now = Date.now();
    const seeded = CUSTOMER_SEED.map((c) => ({ ...c, id: newId() }));
    const { error: seedError } = await this.db.from("customers").upsert(
      seeded.map((c, i) => ({
        ...toRow(c),
        owner_id: owner,
        // Staggered timestamps keep the seed order stable under `order by created_at desc`.
        created_at: new Date(now - i * 1000).toISOString(),
      })),
      { onConflict: "owner_id,email", ignoreDuplicates: true },
    );
    if (seedError) throw new Error(seedError.message);
    const again = await this.db.from("customers").select("*").order("created_at", { ascending: false });
    if (again.error) throw new Error(again.error.message);
    return (again.data as CustomerRow[]).map(fromRow);
  }

  async add(customer: Customer) {
    const { error } = await this.db.from("customers").insert(toRow(customer));
    if (error) throw new Error(error.message);
  }

  async update(id: string, patch: Parameters<CustomerRepo["update"]>[1]) {
    const { error } = await this.db.from("customers").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
  }

  async remove(id: string) {
    const { error } = await this.db.from("customers").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
}
