/**
 * peminjamanMitraService.ts
 *
 * Service layer untuk fitur Permintaan Barang Antar Mitra.
 * Menggunakan endpoint /peminjaman-mitra pada backend.
 *
 * Endpoint yang digunakan:
 *   GET    /peminjaman-mitra           → daftar semua transaksi
 *   POST   /peminjaman-mitra           → buat permintaan baru
 *   PUT    /peminjaman-mitra/:id/status → update status
 *   PUT    /peminjaman-mitra/:id/scan  → simpan hasil scan SN per pihak
 */

import { api } from "@/lib/api";
import type { PeminjamanItem, PeminjamanTransaction } from "@/types/peminjaman";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateRequestPayload = {
  providerPartnerId: string;
  purpose: string;
  notes?: string;
  items: {
    itemName: string;
    brandName: string;
    categoryName: string;
    quantity: number;
    unit: string;
  }[];
};

export type UpdateStatusPayload = {
  status: string;
};

export type ScanSnPayload = {
  scanParty: "provider" | "receiver";
  items: {
    id: string;
    donorSerialNumber?: string;
    donorScannedAt?: string;
    receiverSerialNumber?: string;
    receiverScannedAt?: string;
  }[];
};

// ─── Normalizer ───────────────────────────────────────────────────────────────
// Memastikan data dari server kompatibel dengan tipe lokal kita

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizeTransaction = (raw: any): PeminjamanTransaction => {
  const requester = raw.requesterParty ?? raw.requester ?? {};
  const provider = raw.providerParty ?? raw.provider ?? {};

  return {
    id: String(raw.id ?? raw._id ?? ""),
    requestNumber: raw.requestNumber ?? raw.nomorRequest ?? raw.bastNumber ?? "-",
    requesterPartnerId: String(raw.requesterPartnerId ?? requester.partnerId ?? requester.id ?? ""),
    providerPartnerId: String(raw.providerPartnerId ?? provider.partnerId ?? provider.id ?? ""),
    requesterParty: {
      partnerId: String(requester.partnerId ?? requester.id ?? ""),
      partnerName: String(requester.partnerName ?? requester.name ?? requester.username ?? "-"),
      partnerCode: String(requester.partnerCode ?? requester.code ?? ""),
      picName: String(requester.picName ?? requester.contactPerson ?? ""),
      phone: String(requester.phone ?? ""),
      address: String(requester.address ?? ""),
    },
    providerParty: {
      partnerId: String(provider.partnerId ?? provider.id ?? ""),
      partnerName: String(provider.partnerName ?? provider.name ?? provider.username ?? "-"),
      partnerCode: String(provider.partnerCode ?? provider.code ?? ""),
      picName: String(provider.picName ?? provider.contactPerson ?? ""),
      phone: String(provider.phone ?? ""),
      address: String(provider.address ?? ""),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: (raw.items ?? []).map((item: any): PeminjamanItem => ({
      id: String(item.id ?? item._id ?? Math.random()),
      categoryName: String(item.categoryName ?? item.kategori ?? ""),
      brandName: String(item.brandName ?? item.merek ?? ""),
      itemName: String(item.itemName ?? item.namaBarang ?? item.name ?? ""),
      quantity: Number(item.quantity ?? item.jumlah ?? 1),
      unit: String(item.unit ?? item.satuan ?? "Unit"),
      donorSerialNumber: item.donorSerialNumber ?? item.snPemberi ?? "",
      donorScannedAt: item.donorScannedAt ?? null,
      receiverSerialNumber: item.receiverSerialNumber ?? item.snPenerima ?? "",
      receiverScannedAt: item.receiverScannedAt ?? null,
    })),
    purpose: String(raw.purpose ?? raw.keperluan ?? ""),
    notes: raw.notes ?? raw.catatan ?? undefined,
    status: raw.status ?? "PENDING",
    requestedAt: raw.requestedAt ?? raw.createdAt ?? new Date().toISOString(),
    approvedAt: raw.approvedAt ?? null,
    providerScannedAt: raw.providerScannedAt ?? null,
    receiverScannedAt: raw.receiverScannedAt ?? null,
    completedAt: raw.completedAt ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
};

// ─── Service ──────────────────────────────────────────────────────────────────

export const PeminjamanMitraService = {
  /**
   * Ambil semua permintaan antar mitra.
   * Server sebaiknya memfilter berdasarkan user yang login (via token).
   */
  async getAll(): Promise<PeminjamanTransaction[]> {
    const res = await api.get("/peminjaman-mitra");
    const raw = res.data;
    const list: unknown[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data) ? raw.data : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return list.map((item: any) => normalizeTransaction(item));
  },

  /**
   * Buat permintaan baru.
   */
  async create(payload: CreateRequestPayload): Promise<PeminjamanTransaction> {
    const res = await api.post("/peminjaman-mitra", payload);
    const raw = res.data?.data ?? res.data;
    return normalizeTransaction(raw);
  },

  /**
   * Update status permintaan (setujui, tolak, batalkan, mulai scan, dll).
   */
  async updateStatus(id: string, status: string): Promise<PeminjamanTransaction> {
    const res = await api.put(`/peminjaman-mitra/${id}/status`, { status });
    const raw = res.data?.data ?? res.data;
    return normalizeTransaction(raw);
  },

  /**
   * Simpan hasil scan SN oleh salah satu pihak.
   * Payload berisi semua item beserta SN yang sudah di-scan.
   */
  async saveScan(id: string, payload: ScanSnPayload): Promise<PeminjamanTransaction> {
    const res = await api.put(`/peminjaman-mitra/${id}/scan`, payload);
    const raw = res.data?.data ?? res.data;
    return normalizeTransaction(raw);
  },
};
