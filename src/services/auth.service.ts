import { getBaseUrl, getHeaders, apiFetch } from "@/services/api.client";
import { normalizeAuthUser } from "@/lib/auth.storage";
import type { AuthUser } from "@/types/auth";

type LoginResponse = {
	user?: any;
	data?: any;
	token?: string;
};

export async function login(
	username: string,
	password: string,
): Promise<{ user: AuthUser; token: string | null }> {
	const endpoint = `${getBaseUrl()}/auth/login`;
	const payload = { username, password };

	const rawResponse = await apiFetch<LoginResponse>(endpoint, {
		method: "POST",
		headers: getHeaders(),
		body: JSON.stringify(payload),
	});

	const rawUser = rawResponse.user || rawResponse.data || rawResponse;
	const authenticatedUser = normalizeAuthUser(rawUser);

	return {
		user: authenticatedUser,
		token: rawResponse.token || null,
	};
}
