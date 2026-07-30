import type { RequestSummary, ActivityItem } from "@/types/transaction";

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
    },

    /** Fetch requests dan map ke RequestSummary[] untuk dashboard widgets */
    async getRequests(): Promise<RequestSummary[]> {
        const raw = await this.fetchRequests();
        return (raw as any[]).map((r) => ({
            id: r.id,
            requestNumber: r.requestNumber,
            requesterName: r.requesterName || r.requester?.profile?.nama || r.requester?.username || "Unknown",
            status: r.status,
            requestedAt: r.requestedAt || r.createdAt,
            itemsCount: r.itemsCount ?? (r.requestItems?.reduce((acc: number, item: any) => acc + item.quantity, 0) ?? 0),
        }));
    },

    /** Fetch transactions dan map ke ActivityItem[] — 10 item terbaru */
    async getRecentTransactions(): Promise<ActivityItem[]> {
        const raw = await this.fetchTransactions();
        return (raw as any[])
            .slice(0, 10)
            .map((t) => ({
                id: t.id,
                type: (t.kategori?.toUpperCase() as ActivityItem["type"]) || "MASUK",
                serialNumber: t.sn || t.serialNumber || "-",
                mitra: t.mitra || "KP Tasikmalaya",
                createdAt: t.createdAt || t.tanggal,
            }));
    },
    
    async fetchMitraPerformance() {
        const res = await fetch(`${getBaseUrl()}/dashboard/stats/mitra-performance`, { method: "GET", headers: getHeaders() });
        const raw = await res.json();
        return Array.isArray(raw.data) ? raw.data : [];
    }
};
