import type { LokasiOption, KategoriOption } from "./inventory";

export type Transaction = {
  id: string;
  tanggal: string;
  tanggalDisplay?: string;
  waktu?: string;
  createdAt?: string;
  nomor: string;
  kategori: string;
  status: string;
  sn: string;
  merek: string;
  asal: string | null;
  tujuan: string | null;
  mitra?: string | null;
  keterangan?: string | null;
};

export type BarangMasukItem = {
  id: number;
  nomor: string;
  merek: string;
  kategori: KategoriOption;
  lokasi: LokasiOption;
  status: "Valid" | "Invalid";
  existingItemId?: string;
  source: "KP" | "Mitra" | "Baru";
  asal?: string;
  kondisi?: string;
};

export type BarangKeluarItem = {
  id: number;
  nomor: string;
  merek: string;
  kategori: string;
  lokasi: LokasiOption;
  mitra: string;
  keterangan: string;
  status: "Valid" | "Invalid";
};

export type DashboardTransaction = {
  id: string;
  tanggal: string;
  nomor: string;
  kategori: string;
  status: string;
  sn: string;
  merek: string;
  asal: string;
  tujuan: string;
  mitra: string;
  keterangan: string;
};

export type ChartTransaction = {
  id: string;
  tanggal: string;
  nomor: string;
  kategori: string;
  status: string;
  sn: string;
  merek: string;
  asal: string | null;
  tujuan: string | null;
};

export type RequestItem = {
  id: number
  category: string
  brand: string
  quantity: number
}

export type RequestAllocation = {
  id: number
  materialNumber: string
  category: string
  brand: string
  materialName: string
  serialNumber?: string
  quantity: number
  unit: string
  notes?: string
}

export type DashboardRequest = {
  id: string
  requestNumber: string
  partner: string
  partnerCategory: string
  itemTotal: number
  status: string
  notes: string
  requestedAt: string
  requestItems: RequestItem[]
  requestAllocations?: RequestAllocation[]
}

/** Tipe ringkas untuk widget KPI & tabel "Request Terbaru" di dashboard */
export type RequestSummary = {
  id: string
  requestNumber: string
  requesterName: string
  partnerCategory?: string
  status: string
  requestedAt: string
  itemsCount: number
}

/** Tipe untuk satu item di timeline "Aktivitas Terkini" di dashboard */
export type ActivityItem = {
  id: string
  type: "MASUK" | "KELUAR" | "RUSAK" | "HILANG"
  serialNumber: string
  mitra: string
  createdAt: string
}