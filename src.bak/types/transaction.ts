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
