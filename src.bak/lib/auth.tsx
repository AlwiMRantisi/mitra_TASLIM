import {
	createContext,
	useContext,
	useMemo,
	useState,
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
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<AuthUser | null>(getStoredUser);

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
			logout: () => {
				clearAuthData();
				setUser(null);
			},
		}),
		[user],
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
