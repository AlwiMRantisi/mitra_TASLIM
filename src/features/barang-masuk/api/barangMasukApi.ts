import type { InventoryItem, BrandDefinition } from "@/types/inventory";
import type { Partner } from "@/types/partner";
import { normalizePartnerList } from "@/lib/partner-options";

/**
 * Helper: Mengembalikan Base URL untuk pemanggilan API.
 * 
 * @returns {string} String URL API Backend.
 */
export const getBaseUrl = () => {
  const baseUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_URL || import.meta.env.URL || "https://api-taslim.duckdns.org/";
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

  const partners: Partner[] = normalizePartnerList(rawPartners, {
    activeOnly: true,
    requireMitraRole: true,
  });

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
