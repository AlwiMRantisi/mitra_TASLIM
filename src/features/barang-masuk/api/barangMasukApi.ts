import type { InventoryItem, BrandDefinition } from "@/types/inventory";
import type { Partner } from "@/types/partner";

/**
 * Helper: Mengembalikan Base URL untuk pemanggilan API.
 * 
 * @returns {string} String URL API Backend.
 */
export const getBaseUrl = () => {
  const baseUrl = import.meta.env.URL || import.meta.env.VITE_URL || "http://172.168.9.139:3000/";
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
};

/**
 * Helper: Menyusun header HTTP secara otomatis beserta Authorization token.
 * 
 * @returns {Record<string, string>} Object header HTTP.
 */
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

export const fetchInventoryItems = async (): Promise<InventoryItem[]> => {
  try {
    const resItems = await fetch(`${getBaseUrl()}/items`, { method: "GET", headers: getHeaders() });
    const rawItems = await resItems.json();
    return Array.isArray(rawItems.data || rawItems) ? (rawItems.data || rawItems) : [];
  } catch (error) {
    console.error("Gagal memperbarui data barang dari server:", error);
    throw new Error("Gagal memperbarui data barang dari server.");
  }
};

export interface MasterDataResponse {
  partners: Partner[];
  brands: BrandDefinition[];
  categories: string[];
  models: any[];
  items: InventoryItem[];
  locations: any[]; // Raw locations data
}

/**
 * Mengambil master data secara paralel menggunakan Promise.all untuk mencegah waterfall bottleneck.
 */
export const fetchBarangMasukMasterData = async (): Promise<MasterDataResponse> => {
  const [
    resPartners,
    resBrands,
    resCat,
    resModels,
    items,
    resLoc
  ] = await Promise.all([
    fetch(`${getBaseUrl()}/users`, { method: "GET", headers: getHeaders() }),
    fetch(`${getBaseUrl()}/brands`, { method: "GET", headers: getHeaders() }),
    fetch(`${getBaseUrl()}/categories`, { method: "GET", headers: getHeaders() }),
    fetch(`${getBaseUrl()}/material-models`, { method: "GET", headers: getHeaders() }),
    fetchInventoryItems(),
    fetch(`${getBaseUrl()}/locations`, { method: "GET", headers: getHeaders() }),
  ]);

  const [rawPartners, rawBrands, rawCat, rawModels, rawLoc] = await Promise.all([
    resPartners.json(),
    resBrands.json(),
    resCat.json(),
    resModels.json(),
    resLoc.json(),
  ]);

  const usersList = rawPartners.data || rawPartners.users || rawPartners;
  const partners: Partner[] = (Array.isArray(usersList) ? usersList : [])
    .filter((u: any) => u.role === "MITRA")
    .map((u: any) => ({
      id: String(u.id),
      code: u.profile?.code || u.code || "-",
      name: u.profile?.nama || u.profile?.name || u.name || u.username || "",
      partnerType: u.profile?.partnerType || u.partnerType || "Supplier",
      contactPerson: u.profile?.contactPerson || u.contactPerson || "-",
      phone: u.profile?.telepon || u.profile?.phone || u.phone || "-",
      email: u.profile?.email || u.email || "-",
      address: u.profile?.alamat || u.profile?.address || u.address || "-",
      isActive: u.isAktif !== undefined ? u.isAktif : (u.isActive !== undefined ? u.isActive : true),
      username: u.username || null,
    }))
    .filter(partner => partner.isActive);

  const brandsData = rawBrands.data || rawBrands;
  const brands: BrandDefinition[] = (Array.isArray(brandsData) ? brandsData : []).map((brand: any) => ({
    name: brand.name || brand.nama || "",
    identifier: brand.identifier || "",
  }));

  const catData = rawCat.data || rawCat;
  const categories: string[] = (Array.isArray(catData) ? catData : []).map((c: any) => c.name || c.nama || "");

  const models: any[] = Array.isArray(rawModels.data || rawModels) ? (rawModels.data || rawModels) : [];
  
  const locationsData = rawLoc.data || rawLoc;
  const locations: any[] = Array.isArray(locationsData) ? locationsData : [];

  return {
    partners,
    brands,
    categories,
    models,
    items,
    locations
  };
};
