// Planted security issues for the analyzer fixture.
export const password = "admin123";
export const API_KEY = "abcdef123456";

export function buildQuery(id: string) {
  // Planted SQL injection pattern.
  return query("SELECT * FROM users WHERE id=" + id);
}

declare function query(sql: string): unknown;
