export type User = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "bar_user" | "bartender"; // ⬅️ ahora incluye bartender
  document?: string;                          // ⬅️ agregado
  employeeRole?: "manager" | "bartender" | "cashier" | string; // ⬅️ agregado
  createdAt?: string;
  updatedAt?: string;
};

const TOKEN_KEY = "gb_token";
const USER_KEY  = "gb_user";

export function saveSession(token: string, user: User) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  try { return raw ? JSON.parse(raw) as User : null; } catch { return null; }
}

export function logout() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function hasRole(roles: Array<User["role"]>) {
  const u = getUser();
  return !!u && roles.includes(u.role);
}
