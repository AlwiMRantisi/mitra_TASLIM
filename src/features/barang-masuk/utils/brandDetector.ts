import type { BrandDefinition, BrandOption } from "@/types/inventory";
import type { Partner } from "@/types/partner";

/**
 * Mendeteksi merek barang secara otomatis berdasarkan awalan (prefix) kode serial number.
 * Berguna saat memasukkan barang baru yang belum pernah terdaftar sebelumnya.
 * 
 * @param {string} code - Serial number yang di-scan.
 * @param {BrandDefinition[]} brands - Daftar referensi merek (master data).
 * @returns {BrandOption} Nama merek yang terdeteksi, atau string kosong jika tidak ada yang cocok.
 */
export const detectBrandFromCode = (code: string, brands: BrandDefinition[]): BrandOption => {
  if (!code) return "";
  const normalizedCode = code.trim().toUpperCase();
  const matchedByIdentifier = brands.find((brand) => {
    const normalizedIdentifier = brand.identifier.trim().toUpperCase();
    return normalizedIdentifier && normalizedCode.startsWith(normalizedIdentifier);
  });

  if (matchedByIdentifier) return matchedByIdentifier.name;

  const prefix = normalizedCode.substring(0, 3);
  const matchedByName = brands.find((brand) => brand.name.toUpperCase().startsWith(prefix));
  return matchedByName?.name || "";
};

/**
 * Mendeteksi mitra berdasarkan awalan Serial Number.
 */
export const detectMitraFromSN = (sn: string, partners: Partner[]): string => {
  if (!sn) return "";
  const normalizedSN = sn.trim().toUpperCase();
  const matched = partners.find((partner) => {
    const code = (partner.code || "").trim().toUpperCase();
    return code && normalizedSN.startsWith(code);
  });
  return matched?.name || "";
};
