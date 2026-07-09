import type { AuthUser, UserRole } from "@/types/auth";

const AUTH_STORAGE_KEY = "arxiva-auth-user";
const AUTH_TOKEN_KEY = "arxiva-auth-token";

export function getStoredUser(): AuthUser | null {
	try {
		const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);
		if (!storedUser) return null;
		const parsed = JSON.parse(storedUser);
		return normalizeAuthUser(parsed);
	} catch {
		localStorage.removeItem(AUTH_STORAGE_KEY);
		return null;
	}
}

export function saveAuthUser(user: AuthUser) {
	localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

export function saveAuthToken(token: string) {
	localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthData() {
	localStorage.removeItem(AUTH_STORAGE_KEY);
	localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function normalizeAuthUser(rawUser: any): AuthUser {
	const rawRole =
		typeof rawUser?.role === "string" ? rawUser.role.toLowerCase() : "";
	const role: UserRole = rawRole === "admin" ? "admin" : "mitra";

	// Coba ambil nama dari berbagai lokasi yang mungkin dikembalikan backend
	const profileName =
		rawUser?.profile?.nama ||
		rawUser?.profile?.name ||
		rawUser?.profile?.displayName;

	return {
		id: String(rawUser?.id || rawUser?.userId || ""),
		username: rawUser?.username || rawUser?.email || "",
		displayName:
			profileName ||
			rawUser?.displayName ||
			rawUser?.name ||
			rawUser?.full_name ||
			rawUser?.username ||
			"User",
		role,
		partnerId:
			rawUser?.partnerId !== undefined
				? rawUser.partnerId
				: rawUser?.partner_id || null,
		identityCode:
			rawUser?.identityCode ||
			rawUser?.identity_code ||
			rawUser?.profile?.code ||
			rawUser?.code ||
			(role === "admin" ? "ADM" : "MTR"),
	};
}
