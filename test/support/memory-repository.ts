import { randomUUID } from 'node:crypto';

interface Row {
  id: string;
  email?: string;
  createdAt?: Date;
}

const matches = (row: Row, where: Record<string, unknown>) =>
  Object.entries(where).every(
    ([k, v]) => (row as unknown as Record<string, unknown>)[k] === v,
  );

/**
 * The slice of TypeORM's Repository the services use, in memory. Enforces a
 * unique email like the database does (throws a 23505 error).
 */
export class MemoryRepository<T extends Row> {
  rows: T[] = [];
  private clock = Date.UTC(2026, 0, 1);

  create(data: Partial<T>): T {
    return { ...data } as T;
  }

  async save(entity: T): Promise<T> {
    if (
      entity.email &&
      this.rows.some((r) => r.email === entity.email && r.id !== entity.id)
    ) {
      throw Object.assign(
        new Error('duplicate key value violates unique constraint'),
        { code: '23505' },
      );
    }
    const now = new Date((this.clock += 1000));
    const existing = entity.id
      ? this.rows.find((r) => r.id === entity.id)
      : undefined;
    if (existing) {
      Object.assign(existing, entity, { updatedAt: now });
      return existing;
    }
    const row = {
      isActive: true,
      ...entity,
      id: entity.id ?? randomUUID(),
      createdAt: now,
      updatedAt: now,
    } as T;
    this.rows.push(row);
    return row;
  }

  async findOneBy(where: Record<string, unknown>): Promise<T | null> {
    return this.rows.find((r) => matches(r, where)) ?? null;
  }

  async existsBy(where: Record<string, unknown>): Promise<boolean> {
    return this.rows.some((r) => matches(r, where));
  }

  async findAndCount(opts: {
    skip: number;
    take: number;
  }): Promise<[T[], number]> {
    const sorted = [...this.rows].sort(
      (a, b) => b.createdAt!.getTime() - a.createdAt!.getTime(),
    );
    return [sorted.slice(opts.skip, opts.skip + opts.take), sorted.length];
  }

  async update(
    where: Record<string, unknown>,
    changes: Partial<T>,
  ): Promise<{ affected: number }> {
    const hit = this.rows.filter((r) => matches(r, where));
    hit.forEach((r) => Object.assign(r, changes));
    return { affected: hit.length };
  }

  async delete(where: Record<string, unknown>): Promise<{ affected: number }> {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !matches(r, where));
    return { affected: before - this.rows.length };
  }
}
