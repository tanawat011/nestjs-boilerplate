/** PostgreSQL unique_violation (SQLSTATE 23505), as raised through TypeORM. */
export const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' &&
  err !== null &&
  ((err as { code?: unknown }).code === '23505' ||
    (err as { driverError?: { code?: unknown } }).driverError?.code ===
      '23505');
