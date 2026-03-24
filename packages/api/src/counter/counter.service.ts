import { db } from "../db.js";
import { counterTable } from "./counter.schema.js";

async function ensureRow() {
  const rows = await db.select().from(counterTable);
  if (rows.length === 0) {
    await db.insert(counterTable).values({ value: 0 });
  }
}

export async function getCount(): Promise<number> {
  await ensureRow();
  const [row] = await db.select().from(counterTable);
  return row!.value;
}

export async function setCount(value: number): Promise<number> {
  await ensureRow();
  const [row] = await db.update(counterTable).set({ value }).returning();
  return row!.value;
}
