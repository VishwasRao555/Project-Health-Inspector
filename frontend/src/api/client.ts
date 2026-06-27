import type { AuthResult, HealthReport, ReportSummary } from "../types/contract";

const TOKEN_KEY = "phi.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

  const res = await fetch(`/api${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

export const api = {
  // ----- auth -----
  register: (email: string, password: string) =>
    request<AuthResult>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    request<AuthResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  forgotPassword: (email: string) =>
    request<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),

  // ----- analysis -----
  analyzeUrl: (repoUrl: string) =>
    request<HealthReport>("/analyze", {
      method: "POST",
      body: JSON.stringify({ repoUrl }),
    }),
  analyzeZip: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<HealthReport>("/analyze", { method: "POST", body: form });
  },
  listReports: () => request<ReportSummary[]>("/reports"),
  getReport: (id: string) => request<HealthReport>(`/reports/${id}`),
};
