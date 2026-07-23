export type StatusUnit = "Tersedia" | "Terdistribusi" | "Rusak" | "Hilang";

export interface InventoryItem {
  id: string;
  serialNumber: string;
  kategori: string;
  merek: string;
  tipe?: string;
  status: string;
  lokasiPenyimpanan: string;
  tanggalMasuk: string;
  tanggalKeluar?: string;
  mitra?: string | null;
}

export interface BarangUnit {
  id: string;
  serialNumber: string;
  kategori: string;
  merek: string;
  tipe?: string;
  status: StatusUnit;
  lokasiPenyimpanan: string;
  tanggalMasuk: string;
  tanggalKeluar?: string;
  mitra?: string | null;
}

export interface RiwayatUnit {
  tanggal: string;
  tipe?: string;
  nomorSurat?: string;
  dariStatus?: string;
  keStatus?: string;
  lokasi?: string;
  catatan?: string;
  kategori?: string;
  nomor?: string;
  tujuan?: string;
  asal?: string;
  keterangan?: string;
}

export type CategoryDefinition = {
  name: string;
  safetyStock: number;
};

export type Category = {
  name: string;
  safetyStock: number;
};

export type Kategori = {
  id: string;
  name: string;
  description: string;
  totalItems: number;
  safetyStock: number;
};

export type BrandOption = string;

export type BrandDefinition = {
  name: string;
  identifier: string;
};

export type Merek = {
  id: string;
  nama: string;
  identifier: string;
  origin: string;
  totalItems: number;
};

export type KategoriOption = string;
export type LokasiOption = string;

export type LocationDefinition = {
  name: LokasiOption;
  brandRule: BrandOption;
};

export type StorageLocationOption = {
  name: string;
  owner: string;
};

export type BrandRule = string;

export type Level = {
  id: string;
  name: string;
  capacity: number;
  usedCapacity: number;
  brandRule: BrandRule;
  isActive: boolean;
  sheetUrl?: string | null;
};

export type StorageLocation = {
  id: string;
  name: string;
  type: "Rak" | "Kardus" | "Pallet";
  isActive: boolean;
  levels?: Level[];
  capacity?: number;
  usedCapacity?: number;
  brandRule?: BrandRule;
  sheetUrl?: string | null;
};

export type KodeBarangUpdate = string | ((current: string) => string);

export interface MaterialModel {
  id: number;
  nama: string;
  materialCategoryId: number;
  brandId: number;
  materialCategory?: {
    id: number;
    nama: string;
  };
  brand?: {
    id: number;
    nama: string;
  };
}
