import type { InventoryItem } from "@/types/inventory";

const ADMIN_LOCATION = "KP Tasikmalaya";

export const normalizeKodeBarang = (code: string) => code.trim().toUpperCase();
export const normalizeBrand = (brand: string) => brand.trim().toLocaleLowerCase("id-ID");
export const normalizeStatus = (status: string) => status.trim().toLocaleLowerCase("id-ID");
export const normalizeOwner = (owner?: string | null) =>
  (owner || "").trim().toLocaleLowerCase("id-ID");

/**
 * Memvalidasi apakah Mitra diizinkan untuk menerima/memasukkan barang ini.
 * Mitra hanya bisa menerima barang yang didistribusikan oleh KP, atau barang
 * miliknya sendiri yang sedang berada "diluar".
 * 
 * @param {InventoryItem} item - Data inventaris barang.
 * @param {string} mitraName - Nama Mitra yang sedang login.
 * @returns {boolean} True jika diizinkan, false sebaliknya.
 */
export const isValidMitraInboundSource = (
  item: InventoryItem,
  mitraName: string
) => {
  const owner = normalizeOwner(item.mitra);
  const status = normalizeStatus(item.status);
  const location = normalizeStatus(item.lokasiPenyimpanan || "");

  // Barang dianggap "di luar KP" jika statusnya keluar/diluar,
  // ATAU lokasinya adalah "Keluar"/"Diluar"
  const isOutbound =
    status === "keluar" ||
    status === "diluar" ||
    location === "keluar" ||
    location === "diluar";

  if (!isOutbound) return false;

  // Jika lokasi fisik sudah "Diluar"/"Keluar", barang terbukti berada
  // di luar gudang KP — izinkan mitra menerimanya tanpa validasi owner ketat,
  // karena pengecekan owner bisa gagal akibat perbedaan nama/spasi.
  if (location === "keluar" || location === "diluar") return true;

  // Jika hanya status yang menandakan keluar (lokasi masih di KP),
  // validasi owner agar hanya barang milik mitra sendiri atau KP yang bisa diterima.
  return (
    owner === normalizeOwner(mitraName) ||
    owner === normalizeOwner(ADMIN_LOCATION) ||
    owner === normalizeOwner("KP Tasikmalaya") ||
    owner === normalizeOwner("KP") ||
    owner === ""
  );
};
