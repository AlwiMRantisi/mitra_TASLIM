export const getBaseUrl = () => {
    const baseUrl = import.meta.env.URL || import.meta.env.VITE_URL || "http://172.168.9.139:3000/";
    return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
};

export const getHeaders = () => {
    const token = localStorage.getItem("arxiva-auth-token");
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (token) {
        headers["Authorization"] = `${token}`;
    }
    return headers;
};

export const DashboardService = {
    async fetchTransactions() {
        const res = await fetch(`${getBaseUrl()}/transactions`, { method: "GET", headers: getHeaders() });
        const raw = await res.json();
        return Array.isArray(raw.data || raw) ? (raw.data || raw) : [];
    },
    async fetchItems() {
        const res = await fetch(`${getBaseUrl()}/items`, { method: "GET", headers: getHeaders() });
        const raw = await res.json();
        return Array.isArray(raw.data || raw) ? (raw.data || raw) : [];
    },
    async fetchCategories() {
        const res = await fetch(`${getBaseUrl()}/categories`, { method: "GET", headers: getHeaders() });
        const raw = await res.json();
        return Array.isArray(raw.data || raw) ? (raw.data || raw) : [];
    },
    async fetchRequests() {
        const res = await fetch(`${getBaseUrl()}/requests`, { method: "GET", headers: getHeaders() });
        const raw = await res.json();
        return Array.isArray(raw.data || raw) ? (raw.data || raw) : [];
    }
};
