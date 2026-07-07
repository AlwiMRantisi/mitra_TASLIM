export const getBaseUrl = () => {
	const baseUrl =
		import.meta.env.URL ||
		import.meta.env.VITE_URL ||
		"http://172.168.9.139:3000/";
	return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
};

export const getHeaders = () => {
	const token = localStorage.getItem("arxiva-auth-token");
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};

	if (token) {
		headers["Authorization"] = token;
	}

	return headers;
};

export async function apiFetch<T = any>(
	input: RequestInfo,
	init?: RequestInit,
): Promise<T> {
	const response = await fetch(input, init);
	const data = await response.json();

	if (!response.ok) {
		const errorMessage =
			data?.message || data?.error || response.statusText || "Request failed";
		throw new Error(errorMessage);
	}

	return data;
}
