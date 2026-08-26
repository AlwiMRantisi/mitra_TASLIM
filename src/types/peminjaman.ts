// ─── Tipe Status Alur Permintaan Antar Mitra ─────────────────────────────────

export type PeminjamanStatus =
  | "PENDING"         // Baru diajukan oleh Mitra Peminta (A), menunggu persetujuan Pemberi (B)
  | "DISETUJUI"       // Mitra Pemberi (B) menyetujui permintaan
  | "PEMBERI_SCAN"    // Mitra Pemberi (B) wajib scan/input SN barang yang akan dikirim
  | "PENERIMA_SCAN"   // Mitra Penerima (A) wajib scan/input SN barang yang diterima
  | "SELESAI"         // Kedua pihak sudah scan SN, serah terima selesai
  | "DITOLAK"         // Mitra Pemberi (B) menolak permintaan
  | "DIBATALKAN";     // Permintaan dibatalkan (oleh peminta / sistem)

// ─── Item Barang dalam Permintaan ─────────────────────────────────────────────

export type PeminjamanItem = {
  id: string;
  categoryId?: string;
  categoryName: string;
  brandId?: string;
  brandName: string;
  itemName: string;
  quantity: number;
  unit: string;
  // SN oleh Pemberi (Mitra B) — diisi saat step PEMBERI_SCAN
  donorSerialNumber?: string;
  donorScannedAt?: string | null;
  // SN oleh Penerima (Mitra A) — diisi saat step PENERIMA_SCAN
  receiverSerialNumber?: string;
  receiverScannedAt?: string | null;
};

// ─── Pihak dalam Transaksi ────────────────────────────────────────────────────

export type PeminjamanParty = {
  partnerId: string;
  partnerName: string;
  partnerCode: string;
  picName: string;
  phone: string;
  address: string;
};

// ─── Transaksi Permintaan Antar Mitra ────────────────────────────────────────

export type PeminjamanTransaction = {
  id: string;
  requestNumber: string;       // Nomor request, misal: REQ/2026/08/0001
  requesterPartnerId: string;  // Mitra A — yang mengajukan permintaan
  providerPartnerId: string;   // Mitra B — yang memberikan barang
  requesterParty: PeminjamanParty;
  providerParty: PeminjamanParty;
  items: PeminjamanItem[];
  purpose: string;             // Keperluan permintaan barang
  notes?: string;
  status: PeminjamanStatus;
  // Timestamps per step
  requestedAt: string;        // kapan diajukan
  approvedAt?: string | null;
  providerScannedAt?: string | null; // kapan Pemberi selesai scan semua SN
  receiverScannedAt?: string | null; // kapan Penerima selesai scan semua SN
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};
