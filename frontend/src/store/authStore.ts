import { create } from "zustand";
import { api } from "../api/client";

interface AuthState {
  token: string | null;
  user: { email: string; role: string; full_name: string } | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

function readStoredUser() {
  const stored = localStorage.getItem("user");
  if (!stored) return null;
  try {
    const user = JSON.parse(stored);
    if (user && typeof user.email === "string" && typeof user.role === "string") {
      return user;
    }
  } catch {
    // Ignore corrupt browser state from older local runs.
  }
  localStorage.removeItem("user");
  localStorage.removeItem("access_token");
  return null;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem("access_token"),
  user: readStoredUser(),
  async login(email, password) {
    const response = await api.post("/auth/login", { email, password });
    localStorage.setItem("access_token", response.data.access_token);
    localStorage.setItem("user", JSON.stringify(response.data.user));
    set({ token: response.data.access_token, user: response.data.user });
  },
  logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    set({ token: null, user: null });
  }
}));
