export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export interface Session {
  token: string;
  qrDecryptKey?: string;
  user: { id: string; name: string; email: string; role: "admin" | "volunteer" };
  capabilities?: Record<string, boolean>;
  categoryName?: string | null;
}

export function getSession(): Session | null {
  const raw = localStorage.getItem("reg-desk-session");
  return raw ? JSON.parse(raw) as Session : null;
}

export function setSession(session: Session | null) {
  if (session) {
    localStorage.setItem("reg-desk-session", JSON.stringify(session));
  } else {
    localStorage.removeItem("reg-desk-session");
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = getSession();
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  if (session) {
    headers.set("authorization", `Bearer ${session.token}`);
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(payload.message ?? "Request failed.");
  }
  if (response.status === 204) {
    return {} as T;
  }
  return response.json() as Promise<T>;
}
