/**
 * peminjamanMitraService.ts
 *
 * Service layer untuk fitur Permintaan Barang / Peminjaman Antar Mitra.
 *
 * Endpoint yang digunakan:
 *   GET    /requests?type=inter-partner  → daftar permintaan antar mitra (fallback /requests)
 *   POST   /requests                     → buat permintaan baru (isInterPartner: true)
 *   PUT    /requests/:id/status          → approve / reject oleh ADMIN (fallback /requests/:id)
 *   PUT    /peminjaman-mitra/:id/scan    → simpan hasil scan SN per pihak
 *
 * Seluruh normalisasi dan resolusi nama mitra dipusatkan di sini agar
 * halaman (page) dan komponen tidak menduplikasi logika.
 */

import { api } from "@/lib/api";
import type { InterPartnerRequest } from "@/app/peminjaman-mitra/types";
import { PENDING_APPROVAL_STATUSES } from "@/app/peminjaman-mitra/types";

// ─── HTTP Response unwrap ─────────────────────────────────────────────────────

export const unwrapList = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  const payload = asRecord(value);
  for (const key of ["data", "requests", "items", "results"]) {
    const nested = payload[key];
    if (Array.isArray(nested)) return nested;
  }
  return [];
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const readFirstText = (...values: unknown[]): string => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === "object") continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
};

export const readNumber = (value: unknown, fallback = 0): number => {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export const normalizeKey = (value: unknown): string =>
  readFirstText(value).toLowerCase();

export const normalizeText = (value: unknown): string => {
  if (value === null || value === undefined || typeof value === "object") return "";
  return String(value).trim();
};

// ─── Partner normalization & matching ─────────────────────────────────────────

const normalizePartnerRecord = (value: unknown): Record<string, unknown> => {
  const record = asRecord(value);
  const profile = asRecord(record.profile);
  const partner = asRecord(record.partner);

  return {
    ...record,
    ...profile,
    ...partner,
    id: readFirstText(record.id, record.partnerId, profile.id, partner.id),
    partnerId: readFirstText(record.partnerId, record.partner_id, profile.partnerId, partner.partnerId),
    identityCode: readFirstText(record.identityCode, record.identity_code, profile.identityCode, partner.identityCode),
    name: readFirstText(record.name, record.fullName, profile.name, profile.fullName, partner.name),
    displayName: readFirstText(record.displayName, record.display_name, profile.displayName, profile.display_name, partner.displayName),
    username: readFirstText(record.username, profile.username, partner.username),
    partnerName: readFirstText(record.partnerName, record.partner_name, profile.partnerName, partner.partnerName, record.name, profile.name, partner.name),
  };
};

export const findUserMatch = (users: Record<string, unknown>[], candidates: unknown[]) => {
  const normalizedCandidates = candidates
    .map((candidate) => normalizeKey(candidate))
    .filter(Boolean);

  if (normalizedCandidates.length === 0) return null;

  return (
    users.find((user) => {
      const normalizedUser = normalizePartnerRecord(user);
      const userKeys = [
        normalizedUser.id,
        normalizedUser.partnerId,
        normalizedUser.identityCode,
        normalizedUser.username,
        normalizedUser.displayName,
        normalizedUser.name,
        normalizedUser.partnerName,
      ]
        .map(normalizeKey)
        .filter(Boolean);

      return normalizedCandidates.some((candidate) => userKeys.includes(candidate));
    }) ?? null
  );
};

// ─── Status resolution ────────────────────────────────────────────────────────

/**
 * Konversi status raw backend menjadi status kunci tampilan yang kanonik.
 * Menangani banyak ejaan/format status backend (Indonesia & Inggris, casing).
 */
export const resolveStatusKey = (rawStatus: unknown): string => {
  const raw = readFirstText(rawStatus);
  const normalized = raw.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const providerScanned = Boolean(
    ["provider_scanned", "provider_scan", "pemberi_scan", "pemberi_scanned"].includes(normalized)
  );
  const receiverScanned = Boolean(
    ["receiver_scanned", "receiver_scan", "penerima_scan", "penerima_scanned"].includes(normalized)
  );

  if (["ditolak", "rejected", "declined", "tolak"].includes(normalized)) return "ditolak";
  if (["dibatalkan", "cancelled", "canceled", "cancel"].includes(normalized)) return "dibatalkan";
  if (receiverScanned || ["selesai", "completed", "done", "received", "diterima", "selesai_scan"].includes(normalized)) {
    return "selesai";
  }
  if (providerScanned || ["menunggu_scan_penerima", "menunggu_scan_penerima_2"].includes(normalized)) {
    return "menunggu_scan_penerima";
  }
  if (["menunggu_scan_pemberi", "approved", "disetujui", "setuju", "accepted", "approved_by_admin", "acc", "disetujui_admin"].includes(normalized)) {
    return "menunggu_scan_pemberi";
  }
  if (["siap", "ready", "siap_serah_terima"].includes(normalized)) return "siap";
  if (["menunggu", "pending", "menunggu_persetujuan", "menunggu_persetujuan_admin", "waiting", "waiting_approval", "pending_approval"].includes(normalized)) {
    return "menunggu_persetujuan";
  }
  if (normalized === "diterima" || normalized === "accepted_by_receiver") return "diterima";

  return "menunggu_persetujuan";
};

export const isPendingApproval = (status: string): boolean =>
  PENDING_APPROVAL_STATUSES.some((s) => normalizeKey(s) === normalizeKey(status)) ||
  resolveStatusKey(status) === "menunggu_persetujuan";

// ─── Request normalization ────────────────────────────────────────────────────

const normalizeItem = (
  raw: unknown,
  index: number
): InterPartnerRequest["requestItems"][number] => {
  const item = asRecord(raw);
  return {
    id: readNumber(item.id, index),
    category: readFirstText(item.categoryName, item.category, "-"),
    brand: readFirstText(item.brandName, item.brand, "-"),
    quantity: readNumber(item.quantity, 1),
    unit: readFirstText(item.unit, "Unit"),
  };
};

/**
 * Normalisasi satu record raw dari server menjadi InterPartnerRequest.
 * Nama peminta/pemberi dicocokkan dengan daftar user untuk resolusi nama.
 */
export const normalizeRequest = (
  raw: unknown,
  index: number,
  users: Record<string, unknown>[] = []
): InterPartnerRequest => {
  const rec = asRecord(raw);
  const req = asRecord(rec.requester || rec.requesterParty);
  const prov = asRecord(rec.provider || rec.providerParty);

  const rawItems = Array.isArray(rec.items || rec.requestItems)
    ? ((rec.items || rec.requestItems) as unknown[])
    : [];
  const requestItems = rawItems.map(normalizeItem);

  const requesterMatch = findUserMatch(users, [
    rec.requesterId,
    rec.requesterPartnerId,
    req.id,
    req.partnerId,
    req.identityCode,
    req.username,
    req.name,
    req.partnerName,
    req.displayName,
  ]);

  const providerMatch = findUserMatch(users, [
    rec.providerPartnerId,
    rec.providerId,
    prov.id,
    prov.partnerId,
    prov.identityCode,
    prov.username,
    prov.name,
    prov.partnerName,
    prov.displayName,
  ]);

  const requesterName = readFirstText(
    requesterMatch?.partnerName,
    requesterMatch?.name,
    requesterMatch?.displayName,
    requesterMatch?.username,
    req.partnerName,
    req.name,
    req.displayName,
    req.username,
    rec.requesterName,
    "Mitra Peminta"
  );

  const providerName = readFirstText(
    providerMatch?.partnerName,
    providerMatch?.name,
    providerMatch?.displayName,
    providerMatch?.username,
    prov.partnerName,
    prov.name,
    prov.displayName,
    prov.username,
    rec.providerName,
    "Mitra Pemberi"
  );

  return {
    id: readFirstText(rec.id, rec._id, String(index)),
    requestNumber: readFirstText(rec.requestNumber, rec.nomorRequest, `REQ-MITRA-${index + 1}`),
    requesterPartnerId: readFirstText(rec.requesterPartnerId, rec.requesterId, req.partnerId, req.id, req.identityCode),
    providerPartnerId: readFirstText(rec.providerPartnerId, rec.providerId, prov.partnerId, prov.id, prov.identityCode),
    requesterName,
    providerName,
    itemsCount: requestItems.length || readNumber(rec.itemsCount, 1),
    itemsDetail:
      requestItems
        .map((it) => `${it.category}${it.brand && it.brand !== "-" ? ` / ${it.brand}` : ""} x${it.quantity}`)
        .join(", ") ||
      readFirstText(rec.itemsDetail) ||
      "Item Permintaan",
    status: resolveStatusKey(rec.status ?? rec.approvalStatus ?? rec.state ?? "menunggu_persetujuan"),
    notes: readFirstText(rec.purpose, rec.notes, rec.adminRemarks),
    requestedAt: readFirstText(rec.requestedAt, rec.createdAt),
    requestItems,
    deliveryDocument:
      rec.deliveryDocument != null
        ? {
            kpSignedById: readFirstText(asRecord(rec.deliveryDocument).kpSignedById) || null,
            picSignedById: readFirstText(asRecord(rec.deliveryDocument).picSignedById) || null,
            driveViewUrl: readFirstText(asRecord(rec.deliveryDocument).driveViewUrl) || null,
          }
        : null,
  };
};

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Deteksi apakah sebuah record request dari backend adalah permintaan ANTAR MITRA.
 *
 * Toleran terhadap berbagai representasi backend: boolean `true`, string
 * (`"true"`, `"ya"`, `"1"`, `"inter-partner"`), dan berbagai nama field.
 * Penanda paling kuat: keberadaan `providerPartnerId`/`providerId`/`provider`
 * (hanya dimiliki request antar mitra — request ke KP tidak punya provider).
 */
export const isInterPartnerRequest = (raw: unknown): boolean => {
  const rec = asRecord(raw);

  const providerFields = [
    "providerPartnerId",
    "providerId",
    "providerPartner",
    "provider_id",
    "provider",
    "pemberiId",
    "mitraPemberiId",
    "partnerPemberi",
    "partnerTargetId",
  ];
  const hasProvider = Boolean(
    providerFields.some((key) => {
      const value = rec[key];
      if (value === null || value === undefined) return false;
      if (typeof value === "object") {
        // Objek non-kosong (mis. providerParty/profile) menandakan ada pemberi
        return Object.keys(value as object).length > 0;
      }
      const text = normalizeText(value);
      return text !== "" && normalizeKey(text) !== "undefined";
    })
  );

  const boolFlags = [
    "isInterPartner",
    "isInterPartnerRequest",
    "isAntarMitra",
    "interPartner",
    "antarMitra",
  ];
  for (const key of boolFlags) {
    const value = rec[key];
    if (value === true) return true;
    if (typeof value === "string" && ["true", "1", "ya", "yes", "inter-partner", "antar-mitra"].includes(normalizeKey(value))) {
      return true;
    }
  }

  const typeFlags = ["type", "requestType", "kategori", "category"];
  for (const key of typeFlags) {
    const norm = normalizeKey(rec[key]);
    if (["inter-partner", "inter_partner", "interpartner", "antar-mitra", "antar_mitra", "antarmitra", "peminjaman"].includes(norm)) {
      return true;
    }
  }

  return hasProvider;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export const PeminjamanMitraService = {
  /**
   * Ambil semua permintaan antar mitra.
   * Endpoint aktif: GET /requests?type=inter-partner (fallback GET /requests),
   * difilter untuk record berpenanda isInterPartner / type inter-partner.
   * Nama mitra di-resolve dari daftar /users.
   */
  async getInterPartnerRequests(): Promise<InterPartnerRequest[]> {
    const [requestsRes, usersRes] = await Promise.all([
      api.get("/requests?type=inter-partner").catch(() => api.get("/requests")),
      api.get("/users").catch(() => ({ data: [] })),
    ]);

    const rawList = unwrapList(requestsRes.data);
    const users = unwrapList(usersRes.data).map(normalizePartnerRecord);

    return rawList
      .filter((raw) => isInterPartnerRequest(raw))
      .map((raw, idx) => normalizeRequest(raw, idx, users));
  },

  /**
   * Approve / reject permintaan antar mitra oleh ADMIN.
   * Endpoint: PUT /requests/:id/status dengan status "APPROVED" | "REJECTED".
   * Fallback: PUT /requests/:id.
   */
  async updateApproval(
    id: string,
    decision: "approve" | "reject",
    rejectionNotes?: string
  ): Promise<void> {
    const status = decision === "approve" ? "APPROVED" : "REJECTED";
    const payload: Record<string, unknown> = { status };
    if (decision === "reject" && rejectionNotes) {
      payload.rejectionNotes = rejectionNotes;
      payload.adminRemarks = rejectionNotes;
      payload.notes = rejectionNotes;
    }

    await api
      .put(`/requests/${id}/status`, payload)
      .catch(() => api.put(`/requests/${id}`, { status }));
  },

  /**
   * Simpan hasil scan SN oleh salah satu pihak.
   * Payload berisi semua item beserta SN yang sudah di-scan.
   */
  async saveScan(id: string, payload: ScanSnPayload): Promise<void> {
    await api.put(`/peminjaman-mitra/${id}/scan`, payload);
  },
};
