import { normalizeBrand, normalizeOwner } from "./validators";
import type { BrandOption, LocationDefinition, LokasiOption, InventoryItem } from "@/types/inventory";

const ADMIN_LOCATION = "KP Tasikmalaya";

export const getRecommendedLocation = (
  brand: BrandOption,
  locations: LocationDefinition[],
  availableCapacity: Record<string, number>
): LokasiOption => {
  const availableLocations = locations.filter(
    (location) => (availableCapacity[location.name] ?? 0) > 0
  );
  const normalizedBrand = normalizeBrand(brand);

  if (normalizedBrand) {
    const matchingLocation = availableLocations.find(
      (location) => normalizeBrand(location.brandRule) === normalizedBrand
    );
    if (matchingLocation) return matchingLocation.name;
  }

  const mixedLocation = availableLocations.find((location) => {
    const normalizedRule = normalizeBrand(location.brandRule);
    return !normalizedRule || normalizedRule === "campuran";
  });

  return mixedLocation?.name || availableLocations[0]?.name || "";
};

export const getMitraDefaultLocation = (mitraName: string): LokasiOption =>
  `Gudang ${mitraName.trim() || "Mitra"}`;

/**
 * Menghitung kapasitas yang tersedia untuk setiap lokasi.
 * Dioptimalkan menggunakan frequency map (O(L + I)) agar tidak terjadi bottleneck (O(L * I)).
 */
export const calculateCapacityMap = (
  locationsData: any[],
  items: InventoryItem[],
  locationOwner: string
): { locs: LocationDefinition[]; newKuota: Record<string, number> } => {
  // 1. Build frequency map of used capacity (O(I))
  const usedCapacityMap: Record<string, number> = {};
  items.forEach(item => {
    if (!item.lokasiPenyimpanan) return;
    const st = (item.status || "").trim().toLowerCase();
    if (st !== "diluar" && st !== "keluar") {
      const locKey = item.lokasiPenyimpanan.trim();
      usedCapacityMap[locKey] = (usedCapacityMap[locKey] || 0) + 1;
    }
  });

  // 2. Map locations and calculate remaining capacity (O(L))
  const locs: LocationDefinition[] = [];
  const newKuota: Record<string, number> = {};

  locationsData.forEach((loc: any) => {
    if (loc.isActive === false) return;
    if (loc.name === "Keluar" || loc.name === "Diluar") return;
    if (
      normalizeOwner(loc.owner || ADMIN_LOCATION) !==
      normalizeOwner(locationOwner)
    ) {
      return;
    }

    if (loc.type === "Rak" && loc.levels) {
      loc.levels.forEach((lvl: any) => {
        if (lvl.isActive === false) return;

        const name = `${loc.name} - ${lvl.name}`;
        locs.push({
          name,
          brandRule: lvl.brandRule || "Campuran",
        });
        const actualUsed = usedCapacityMap[name] || 0;
        newKuota[name] = Math.max(0, lvl.capacity - actualUsed);
      });
    } else {
      locs.push({
        name: loc.name,
        brandRule: loc.brandRule || "Campuran",
      });
      const actualUsed = usedCapacityMap[loc.name] || 0;
      newKuota[loc.name] = Math.max(0, (loc.capacity || 0) - actualUsed);
    }
  });

  return { locs, newKuota };
};
