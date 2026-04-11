import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { User, RegisterInput } from "@shared/schema";

type AuthState = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isHealthWorker: boolean;
  isDoctor: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (data: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

const API_BASE = "/api";

async function fetchCurrentUser(): Promise<User | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: user = null, isLoading } = useQuery<User | null>({
    queryKey: ["auth", "me"],
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ identifier, password }: any) => {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      return data as User;
    },
    onSuccess: (data) => queryClient.setQueryData(["auth", "me"], data),
  });

  const registerMutation = useMutation({
    mutationFn: async (payload: RegisterInput) => {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      return data as User;
    },
    onSuccess: (data) => queryClient.setQueryData(["auth", "me"], data),
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Logout failed");
    },
    onSuccess: () => {
      queryClient.setQueryData(["auth", "me"], null);
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });

  const value = useMemo<AuthState>(() => {
    return {
      user,
      isLoading,
      isAuthenticated: !!user,
      isAdmin: user?.role === "admin",
      isHealthWorker: user?.role === "health_worker",
      isDoctor: user?.role === "doctor",
      login: async (identifier, password) => {
        await loginMutation.mutateAsync({ identifier, password });
      },
      register: async (data) => {
        await registerMutation.mutateAsync(data);
      },
      logout: async () => {
        await logoutMutation.mutateAsync();
      },
    };
  }, [user, isLoading, loginMutation, registerMutation, logoutMutation]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
