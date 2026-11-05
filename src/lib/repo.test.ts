import { describe, expect, it, vi } from "vitest";
import { CUSTOMER_SEED } from "./model";
import { fromRow, LocalRepo, SupabaseRepo, toRow, type CustomerRow } from "./repo";

const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
};

const sample = { ...CUSTOMER_SEED[0], id: "new-1", name: "Zephyr Works", email: "z@zephyr.example" };

describe("LocalRepo", () => {
  it("devuelve el workspace de muestra la primera vez", async () => {
    const repo = new LocalRepo("t", memory());
    expect(await repo.list()).toHaveLength(CUSTOMER_SEED.length);
  });

  it("guarda altas, cambios y bajas entre instancias", async () => {
    const store = memory();
    const a = new LocalRepo("t", store);
    await a.list();
    await a.add(sample);
    await a.update("new-1", { status: "churned" });
    const b = new LocalRepo("t", store);
    const list = await b.list();
    expect(list[0]).toMatchObject({ id: "new-1", status: "churned" });
    await b.remove("new-1");
    expect((await new LocalRepo("t", store).list()).some((c) => c.id === "new-1")).toBe(false);
  });

  it("aísla los datos por ámbito", async () => {
    const store = memory();
    await new LocalRepo("a", store).add(sample);
    expect((await new LocalRepo("b", store).list()).some((c) => c.id === "new-1")).toBe(false);
  });

  it("clear() restaura la muestra", async () => {
    const store = memory();
    const repo = new LocalRepo("t", store);
    await repo.add(sample);
    repo.clear();
    expect((await repo.list()).some((c) => c.id === "new-1")).toBe(false);
  });

  it("se recupera de datos corruptos", async () => {
    const store = memory();
    store.setItem("lumen:customers:v1:t", "{not json");
    expect(await new LocalRepo("t", store).list()).toHaveLength(CUSTOMER_SEED.length);
  });
});

describe("mapeo de filas", () => {
  it("toRow/fromRow son inversos", () => {
    expect(fromRow(toRow(sample))).toEqual(sample);
  });

  it("tolera invoices null", () => {
    const row = { ...toRow(sample), invoices: null } as CustomerRow;
    expect(fromRow(row).invoices).toEqual([]);
  });
});

/** Fake of the slice of supabase-js that SupabaseRepo uses, backed by an array. */
const fakeDb = () => {
  const rows: CustomerRow[] = [];
  const upsert = vi.fn(async (batch: CustomerRow[], opts?: { ignoreDuplicates?: boolean }) => {
    for (const r of batch) if (!rows.some((x) => x.email === r.email)) rows.push(r);
    void opts;
    return { error: null };
  });
  const db = {
    auth: { getSession: async () => ({ data: { session: { user: { id: "u1" } } } }) },
    from: () => ({
      select: () => ({
        order: async () => {
          await Promise.resolve();
          return { data: [...rows], error: null };
        },
      }),
      upsert,
      insert: async (r: CustomerRow) => (rows.push(r), { error: null }),
      update: (patch: Partial<CustomerRow>) => ({
        eq: async (_c: string, id: string) => (Object.assign(rows.find((r) => r.id === id) ?? {}, patch), { error: null }),
      }),
      delete: () => ({
        eq: async (_c: string, id: string) => {
          const i = rows.findIndex((r) => r.id === id);
          if (i >= 0) rows.splice(i, 1);
          return { error: null };
        },
      }),
    }),
  };
  return { db: db as never, rows, upsert };
};

describe("SupabaseRepo", () => {
  it("siembra la muestra una sola vez aunque list() se llame en paralelo", async () => {
    const { db, rows, upsert } = fakeDb();
    const repo = new SupabaseRepo(db);
    const [a, b] = await Promise.all([repo.list(), repo.list()]);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(CUSTOMER_SEED.length);
    expect(a).toHaveLength(CUSTOMER_SEED.length);
    expect(b).toBe(a);
  });

  it("no vuelve a sembrar si ya hay datos", async () => {
    const { db, upsert } = fakeDb();
    const repo = new SupabaseRepo(db);
    await repo.list();
    await repo.list();
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("propaga el error del backend", async () => {
    const { db } = fakeDb();
    (db as { from: unknown }).from = () => ({
      insert: async () => ({ error: { message: "row-level security violation" } }),
    });
    await expect(new SupabaseRepo(db).add(sample)).rejects.toThrow("row-level security violation");
  });
});
