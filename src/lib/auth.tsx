import {
	createContext,
	useContext,
	useMemo,
	useState,
	useEffect,
	useCallback,
	type ReactNode,
} from "react";
import { login as authLogin } from "@/services/auth.service";
import {
	clearAuthData,
	getStoredUser,
	saveAuthToken,
	saveAuthUser,
} from "@/lib/auth.storage";
import type { AuthUser } from "@/types/auth";

type AuthContextValue = {
	user: AuthUser | null;
	login: (username: string, password: string) => Promise<AuthUser>;
	logout: () => void;
	updateUser: (updates: Partial<AuthUser>) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<AuthUser | null>(getStoredUser);

	const logout = useCallback(() => {
		clearAuthData();
		setUser(null);
	}, []);

	// Pilar A: Global HTTP Interceptor (Mengintersep window.fetch)
	useEffect(() => {
		const originalFetch = window.fetch;

		window.fetch = async (...args) => {
			const response = await originalFetch(...args);

			// Ambil URL request
			const url =
				typeof args[0] === "string" ? args[0] : (args[0] as Request).url;

			// Jika status 401 (Unauthorized) dan bukan request login
			if (response.status === 401 && !url.includes("/auth/login")) {
				logout();
			}

			return response;
		};

		return () => {
			// Kembalikan ke fungsi fetch asli saat unmount
			window.fetch = originalFetch;
		};
	}, [logout]);

	// Pilar B & C: Cek Expiration & Timer Aktif
	useEffect(() => {
		const token = localStorage.getItem("arxiva-auth-token");
		if (!token) return;

		try {
			// Decode JWT Payload
			const base64Url = token.split(".")[1];
			const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
			const jsonPayload = decodeURIComponent(
				window
					.atob(base64)
					.split("")
					.map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
					.join(""),
			);

			const { exp } = JSON.parse(jsonPayload);
			if (!exp) return;

			const expirationTime = exp * 1000;
			const delay = expirationTime - Date.now();

			if (delay <= 0) {
				logout();
			} else {
				const timer = setTimeout(() => {
					logout();
				}, delay);

				return () => clearTimeout(timer);
			}
		} catch (error) {
			logout();
		}
	}, [user, logout]);

	const value = useMemo<AuthContextValue>(
		() => ({
			user,
			login: async (username: string, password: string) => {
				const { user: authenticatedUser, token } = await authLogin(
					username,
					password,
				);

				if (token) {
					saveAuthToken(token);
				}

				saveAuthUser(authenticatedUser);
				setUser(authenticatedUser);

				return authenticatedUser;
			},
			logout,
			updateUser: (updates: Partial<AuthUser>) => {
				if (user) {
					const newUser = { ...user, ...updates };
					saveAuthUser(newUser);
					setUser(newUser);
				}
			},
		}),
		[user, logout],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth harus digunakan di dalam AuthProvider.");
	}

	return context;
}
