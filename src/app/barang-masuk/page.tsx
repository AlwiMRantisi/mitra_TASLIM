import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { PackagePlus, ScanLine, X, Loader2, Wrench, Lock, ChevronsUpDown, Check, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import type { BrandOption, BrandDefinition, KategoriOption, LokasiOption, LocationDefinition, InventoryItem, KodeBarangUpdate } from "@/types/inventory";
import type { BarangMasukItem } from "@/types/transaction";
import type { Partner } from "@/types/partner";

/**
 * Helper: Mengembalikan Base URL untuk pemanggilan API.
 * 
 * @returns {string} String URL API Backend.
 */
const getBaseUrl = () => {
  const baseUrl = import.meta.env.URL || import.meta.env.VITE_URL || "http://172.168.9.139:3000/";
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
};

/**
 * Helper: Menyusun header HTTP secara otomatis beserta Authorization token.
 * 
 * @returns {Record<string, string>} Object header HTTP.
 */
const getHeaders = () => {
  const token = localStorage.getItem("arxiva-auth-token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `${token}`;
  }
  return headers;
};

const ADMIN_LOCATION = "KP Tasikmalaya";

/**
 * Mendeteksi merek barang secara otomatis berdasarkan awalan (prefix) kode serial number.
 * Berguna saat memasukkan barang baru yang belum pernah terdaftar sebelumnya.
 * 
 * @param {string} code - Serial number yang di-scan.
 * @param {BrandDefinition[]} brands - Daftar referensi merek (master data).
 * @returns {BrandOption} Nama merek yang terdeteksi, atau string kosong jika tidak ada yang cocok.
 */
const detectBrandFromCode = (code: string, brands: BrandDefinition[]): BrandOption => {
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
 * Mengecek apakah event berasal dari elemen input teks, textarea, atau konten editable.
 * Berguna agar global keyboard listener (scanner) tidak membajak input pengguna saat mengetik.
 */
const detectMitraFromSN = (sn: string, partners: Partner[]): string => {
  if (!sn) return "";
  const normalizedSN = sn.trim().toUpperCase();
  const matched = partners.find((partner) => {
    const code = (partner.code || "").trim().toUpperCase();
    return code && normalizedSN.startsWith(code);
  });
  return matched?.name || "";
};

const isTextInputTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, [contenteditable='true']"));
};

const normalizeKodeBarang = (code: string) => code.trim().toUpperCase();
const normalizeBrand = (brand: string) => brand.trim().toLocaleLowerCase("id-ID");
const normalizeStatus = (status: string) => status.trim().toLocaleLowerCase("id-ID");
const normalizeOwner = (owner?: string | null) =>
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
const isValidMitraInboundSource = (
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

const getRecommendedLocation = (
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

const getMitraDefaultLocation = (mitraName: string): LokasiOption =>
  `Gudang ${mitraName.trim() || "Mitra"}`;

function EmptyScanTableState() {
  return (
    <div className="flex items-center justify-center px-6 py-12">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
          <PackagePlus className="size-7" strokeWidth={1.8} />
        </div>
        <div className="space-y-1.5">
          <p className="text-base font-semibold text-foreground">Belum ada barang masuk</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Scan atau masukkan serial number dari form di sebelah kiri untuk menambahkan item ke sesi ini.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Komponen BarangMasukPage
 * 
 * Modul operasional Gudang untuk mencatat penerimaan barang masuk.
 * Menangani pembuatan inventaris baru (untuk Admin/KP) dan 
 * penerimaan distribusi (untuk Mitra) dengan deteksi cerdas merek & lokasi rak.
 * 
 * @returns {JSX.Element} Antarmuka halaman barang masuk.
 */
export default function BarangMasukPage() {
  const { user } = useAuth();
  const [kodeBarang, setKodeBarang] = useState("");
  const [barangMasuk, setBarangMasuk] = useState<BarangMasukItem[]>([]);
  const [kuota, setKuota] = useState<Record<string, number>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const kodeBarangRef = useRef("");
  const [dbBrands, setDbBrands] = useState<BrandDefinition[]>([]);
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [dbModels, setDbModels] = useState<any[]>([]);
  const [dbLocations, setDbLocations] = useState<LocationDefinition[]>([]);
  const [, setDbItems] = useState<InventoryItem[]>([]);
  const [dbPartners, setDbPartners] = useState<Partner[]>([]);
  const [asalBarangManual, setAsalBarangManual] = useState<boolean>(false);
  const [asalBarang, setAsalBarang] = useState<string>("SBU Regional Jawa Barat");
  const [kondisiBarang, setKondisiBarang] = useState<string>("Baru");
  const [tipeBarang, setTipeBarang] = useState<string>("");
  const [openModelPopover, setOpenModelPopover] = useState(false);
  const [modelSearch, setModelSearch] = useState("");

  const filteredModels = useMemo(() => {
    if (!modelSearch.trim()) return dbModels;
    const q = modelSearch.toLowerCase();
    return dbModels.filter((m) => {
      const nama = (m.nama || "").toLowerCase();
      const brand = (m.brand?.nama || m.brand?.name || "").toLowerCase();
      return nama.includes(q) || brand.includes(q);
    });
  }, [dbModels, modelSearch]);
  const [isSaving, setIsSaving] = useState(false);

  const refreshInventoryItems = useCallback(async () => {
    try {
      const resItems = await fetch(`${getBaseUrl()}/items`, { method: "GET", headers: getHeaders() });
      const rawItems = await resItems.json();
      const items = Array.isArray(rawItems.data || rawItems) ? (rawItems.data || rawItems) : [];
      setDbItems(items);
      return items as InventoryItem[];
    } catch (error) {
      console.error("Gagal memperbarui data barang dari server:", error);
      toast.error("Gagal memperbarui data barang dari server.");
      return [] as InventoryItem[];
    }
  }, []);

  // Fetch brands, categories, and locations from database
  useEffect(() => {
    const fetchData = async () => {
      try {
        const resPartners = await fetch(`${getBaseUrl()}/users`, { method: "GET", headers: getHeaders() });
        const rawPartners = await resPartners.json();
        const usersList = rawPartners.data || rawPartners.users || rawPartners;
        const partners: Partner[] = (Array.isArray(usersList) ? usersList : []).filter((u: any) => u.role === "MITRA").map((u: any) => ({
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
        }));
        setDbPartners(partners.filter((partner) => partner.isActive));

        const resBrands = await fetch(`${getBaseUrl()}/brands`, { method: "GET", headers: getHeaders() });
        const rawBrands = await resBrands.json();
        const brands = rawBrands.data || rawBrands;
        const brandDefinitions = (Array.isArray(brands) ? brands : []).map((brand: any) => ({
          name: brand.name || brand.nama || "",
          identifier: brand.identifier || "",
        }));
        setDbBrands(brandDefinitions);

        const resCat = await fetch(`${getBaseUrl()}/categories`, { method: "GET", headers: getHeaders() });
        const rawCat = await resCat.json();
        const categories = rawCat.data || rawCat;
        const categoryNames = (Array.isArray(categories) ? categories : []).map((c: any) => c.name || c.nama || "");
        setDbCategories(categoryNames);


        const resModels = await fetch(`${getBaseUrl()}/material-models`, { method: "GET", headers: getHeaders() });
        const rawModels = await resModels.json();
        setDbModels(Array.isArray(rawModels.data || rawModels) ? (rawModels.data || rawModels) : []);

        const items = await refreshInventoryItems();

        const resLoc = await fetch(`${getBaseUrl()}/locations`, { method: "GET", headers: getHeaders() });
        const rawLoc = await resLoc.json();
        const locationsData = rawLoc.data || rawLoc;
        const locs: LocationDefinition[] = [];
        const newKuota: Record<string, number> = {};
        const locationOwner =
          user?.role === "mitra" ? user.displayName : ADMIN_LOCATION;

        (Array.isArray(locationsData) ? locationsData : []).forEach((loc: any) => {
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
              const actualUsed = (Array.isArray(items) ? items : []).filter((item: any) => {
                if (!item.lokasiPenyimpanan) return false;
                const st = (item.status || "").trim().toLowerCase();
                return item.lokasiPenyimpanan.trim() === name.trim() && st !== "diluar" && st !== "keluar";
              }).length;
              newKuota[name] = Math.max(0, lvl.capacity - actualUsed);
            });
          } else {
            locs.push({
              name: loc.name,
              brandRule: loc.brandRule || "Campuran",
            });
            const actualUsed = (Array.isArray(items) ? items : []).filter((item: any) => {
              if (!item.lokasiPenyimpanan) return false;
              const st = (item.status || "").trim().toLowerCase();
              return item.lokasiPenyimpanan.trim() === loc.name.trim() && st !== "diluar" && st !== "keluar";
            }).length;
            newKuota[loc.name] = Math.max(
              0,
              (loc.capacity || 0) - actualUsed
            );
          }
        });
        setDbLocations(locs);
        setKuota(newKuota);

      } catch (error) {
        console.error("Gagal mengambil data dari database:", error);
        toast.error("Gagal memuat data barang masuk.");
      }
    };
    void fetchData();
  }, [refreshInventoryItems, user]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshInventoryItems();
      }
    };

    window.addEventListener("focus", handleVisibilityChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleVisibilityChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshInventoryItems]);

  const totalKuotaTersedia = Object.values(kuota).reduce((total, value) => total + value, 0);
  const validItems = barangMasuk.filter((item) => item.status === "Valid").length;

  const updateKodeBarang = useCallback((value: KodeBarangUpdate) => {
    const nextValue = typeof value === "function" ? value(kodeBarangRef.current) : value;
    kodeBarangRef.current = nextValue;
    setKodeBarang(nextValue);
  }, []);

  const focusKodeBarangInput = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  // Auto-focus pada input ketika component mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /**
   * Menangani aksi submit (scan/input manual) kode barang.
   * Melakukan validasi kompleks seperti rekomendasi lokasi otomatis
   * berdasarkan sisa kuota dan aturan merek rak.
   * 
   * @param {string} kodeOverride - Kode serial number yang akan disubmit.
   */
  // Auto-detect mitra dari SN dan set asal barang otomatis
  useEffect(() => {
    if (asalBarangManual) return;
    const detectedMitra = detectMitraFromSN(kodeBarang, dbPartners);
    if (detectedMitra) {
      setAsalBarang(detectedMitra);
    } else {
      setAsalBarang("SBU Regional Jawa Barat");
    }
  }, [kodeBarang, dbPartners, asalBarangManual]);

  const handleSubmit = useCallback(async (kodeOverride = kodeBarang) => {
    const trimmedKode = kodeOverride.trim();
    if (!trimmedKode) return;

    // Validasi duplikasi pada sesi saat ini
    const isDuplicate = barangMasuk.some(
      (item) => normalizeKodeBarang(item.nomor) === normalizeKodeBarang(trimmedKode)
    );

    if (isDuplicate) {
      toast.error("Serial number sudah ada di sesi ini.", {
        description: trimmedKode,
      });
      updateKodeBarang("");
      focusKodeBarangInput();
      return;
    }

    const latestItems = await refreshInventoryItems();
    const existingItem = latestItems.find(
      (item) => normalizeKodeBarang(item.serialNumber) === normalizeKodeBarang(trimmedKode)
    );

    if (user?.role === "mitra" && !existingItem) {
      toast.error("Barang belum terdaftar di KP.", {
        description: `${trimmedKode} harus didaftarkan oleh Admin terlebih dahulu.`,
      });
      updateKodeBarang("");
      focusKodeBarangInput();
      return;
    }

    if (
      user?.role === "mitra" &&
      existingItem &&
      !isValidMitraInboundSource(existingItem, user.displayName)
    ) {
      const status = existingItem.status || "tidak diketahui";
      const lokasi = existingItem.lokasiPenyimpanan || "gudang KP";
      toast.error("Barang belum bisa diterima.", {
        description: `${trimmedKode} masih berstatus "${status}" di "${lokasi}". Barang harus sudah keluar dari KP terlebih dahulu.`,
      });
      updateKodeBarang("");
      focusKodeBarangInput();
      return;
    }

    if (kondisiBarang === "Baru") {
      if (existingItem) {
        toast.error("Barang sudah ada di database.", {
          description: "SN ini sudah terdaftar. Silakan gunakan kondisi 'Dismantle'.",
        });
        updateKodeBarang("");
        focusKodeBarangInput();
        return;
      }
    } else if (kondisiBarang === "Dismantle") {
      if (!existingItem) {
        toast.error("Barang tidak ditemukan di database.", {
          description: "SN ini belum terdaftar. Silakan gunakan kondisi 'Baru'.",
        });
        updateKodeBarang("");
        focusKodeBarangInput();
        return;
      }
    }

    const selectedModelInfo = tipeBarang && kondisiBarang === "Baru"
      ? dbModels.find((m) => m.nama === tipeBarang)
      : null;

    // Tentukan Merek untuk rekomendasi lokasi
    const itemBrand =
      existingItem?.merek ||
      (selectedModelInfo?.brand?.nama || selectedModelInfo?.brand?.name) ||
      detectBrandFromCode(trimmedKode, dbBrands) ||
      "";

    // Rekomendasi Lokasi Otomatis (Smart Routing)
    let recommendedLocation = getRecommendedLocation(itemBrand, dbLocations, kuota);
    const isMitraUser = user?.role === "mitra";

    if (isMitraUser && !recommendedLocation && existingItem) {
      recommendedLocation = getMitraDefaultLocation(user.displayName);
    }

    if (
      !isMitraUser &&
      existingItem &&
      normalizeStatus(existingItem.status) !== "keluar" &&
      normalizeStatus(existingItem.status) !== "diluar"
    ) {
      if (recommendedLocation && recommendedLocation.trim().toLowerCase() === (existingItem.lokasiPenyimpanan || "").trim().toLowerCase()) {
        const alternativeLocation = dbLocations.find(
          (loc) => (kuota[loc.name] ?? 0) > 0 && loc.name.trim().toLowerCase() !== (existingItem.lokasiPenyimpanan || "").trim().toLowerCase()
        );
        if (alternativeLocation) {
          recommendedLocation = alternativeLocation.name;
        } else {
          toast.error("Barang sudah berada di lokasi tersebut dan tidak dapat dimasukkan kembali kecuali pindah penyimpanan.", {
            description: `Lokasi saat ini: ${existingItem.lokasiPenyimpanan}`,
          });
          updateKodeBarang("");
          focusKodeBarangInput();
          return;
        }
      }
    }

    if (!recommendedLocation) {
      toast.error(
        dbLocations.length === 0
          ? "Tidak ada lokasi penyimpanan aktif yang tersedia."
          : "Semua lokasi penyimpanan sudah penuh."
      );
      focusKodeBarangInput();
      return;
    }

    const newItem: BarangMasukItem = {
      id: Date.now(),
      nomor: trimmedKode,
      merek: kondisiBarang === "Dismantle" ? (existingItem?.merek || "") : (itemBrand || ""),
      kategori: kondisiBarang === "Dismantle" ? (existingItem?.kategori || "") : "ONT",
      tipe: kondisiBarang === "Dismantle" ? (existingItem?.tipe || "") : (kondisiBarang === "Baru" ? tipeBarang : ""),
      lokasi: recommendedLocation,
      status: "Valid",
      existingItemId: existingItem?.id,
      source:
        user?.role === "mitra" && existingItem && isValidMitraInboundSource(existingItem, user.displayName)
          ? "KP"
          : normalizeOwner(existingItem?.mitra) === normalizeOwner(ADMIN_LOCATION) || normalizeOwner(existingItem?.mitra) === normalizeOwner("KP Tasikmalaya")
            ? "KP"
            : existingItem
              ? "Mitra"
              : "Baru",
      asal: asalBarang,
      kondisi: kondisiBarang,
    };

    setBarangMasuk((current) => [newItem, ...current]);
    setKuota((current) => ({
      ...current,
      [recommendedLocation]: current[recommendedLocation] - 1,
    }));

    updateKodeBarang("");
    setAsalBarangManual(false);

    // Auto-focus kembali ke input setelah submit
    focusKodeBarangInput();
  }, [
    barangMasuk,
    dbBrands,
    dbLocations,
    refreshInventoryItems,
    focusKodeBarangInput,
    kodeBarang,
    kuota,
    updateKodeBarang,
    user,
    asalBarang,
    kondisiBarang,
    asalBarangManual,
  ]);

  /**
   * Mengarahkan input keyboard atau barcode scanner ke field Kode/SN secara otomatis.
   * Listener global ini memungkinkan user melakukan "blind scan".
   */
  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      // Abaikan shortcut sistem (Ctrl/Cmd/Alt)
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) {
        return;
      }

      // Pastikan hanya tombol karakter tunggal, backspace, atau enter yang ditangkap
      const isSupportedKey = event.key.length === 1 || event.key === "Backspace" || event.key === "Enter";
      if (!isSupportedKey || isTextInputTarget(event.target)) {
        return;
      }

      // Hindari saat select dropdown terbuka
      if (document.querySelector("[data-slot='select-content']")) {
        return;
      }

      event.preventDefault();
      inputRef.current?.focus();

      if (event.key === "Enter") {
        void handleSubmit(kodeBarangRef.current);
        return;
      }

      if (event.key === "Backspace") {
        updateKodeBarang((current) => current.slice(0, -1));
        return;
      }

      updateKodeBarang((current) => `${current}${event.key}`);
    };

    window.addEventListener("keydown", handleWindowKeyDown);

    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [handleSubmit, updateKodeBarang]);

  const handleDeleteItem = (id: number) => {
    const itemToDelete = barangMasuk.find((item) => item.id === id);
    if (itemToDelete) {
      // Tambah kembali kuota lokasi
      setKuota((current) => {
        if (!(itemToDelete.lokasi in current)) return current;

        return {
          ...current,
          [itemToDelete.lokasi]: current[itemToDelete.lokasi] + 1,
        };
      });
    }
    setBarangMasuk((current) => current.filter((item) => item.id !== id));
  };

  const handleUpdateInline = (id: number, field: keyof BarangMasukItem, value: any) => {
    setBarangMasuk((current) =>
      current.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };
          // Jika merek diubah, reset tipe
          if (field === "merek" && value !== item.merek) {
            updatedItem.tipe = "";
          }
          return updatedItem;
        }
        return item;
      })
    );
  };

  const handleUpdateLokasi = (id: number, newLokasi: LokasiOption) => {
    const itemToUpdate = barangMasuk.find((item) => item.id === id);
    if (!itemToUpdate) return;

    const oldLokasi = itemToUpdate.lokasi;

    // Check if kuota lokasi baru tersedia
    if (newLokasi !== oldLokasi && (kuota[newLokasi] ?? Number.POSITIVE_INFINITY) <= 0) {
      toast.error("Kuota lokasi sudah penuh.", {
        description: newLokasi,
      });
      return;
    }

    // Update barang lokasi
    setBarangMasuk((current) =>
      current.map((item) =>
        item.id === id ? { ...item, lokasi: newLokasi } : item
      )
    );

    // Update kuota: kembalikan kuota lokasi lama, kurangi kuota lokasi baru
    if (newLokasi !== oldLokasi) {
      setKuota((current) => ({
        ...current,
        ...(oldLokasi in current ? { [oldLokasi]: current[oldLokasi] + 1 } : {}),
        ...(newLokasi in current ? { [newLokasi]: current[newLokasi] - 1 } : {}),
      }));
    }
  };

  /**
   * Memvalidasi seluruh transaksi di sesi saat ini ke database dan melakukan update/insert status inventaris.
   * Menyimpan histori ('transactions') dan membuat/mengubah item ('items') menjadi berstatus "Tersedia".
   */
  const handleValidateAll = async () => {
    if (isSaving) return;

    const hasIncompleteNewItems = barangMasuk.some(
      (item) => item.kondisi === "Baru" && !item.tipe
    );
    if (hasIncompleteNewItems) {
      toast.error("Masih ada barang Baru yang belum memiliki Model Material.", {
        description: "Silakan lengkapi Model Material di tabel sebelum menyimpan.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const sessionDate = new Date().toISOString().slice(0, 10);
      const dateStr = sessionDate.replace(/-/g, "");

      // Mendapatkan nomor urut transaksi harian
      const resTrx = await fetch(`${getBaseUrl()}/transactions`, { method: "GET", headers: getHeaders() });
      const rawTrx = await resTrx.json();
      const txs = rawTrx.data || rawTrx;
      const prefix = `IN-${dateStr}-`;
      let maxNum = 0;
      (Array.isArray(txs) ? txs : []).forEach((t: any) => {
        if (t.nomor && t.nomor.startsWith(prefix)) {
          const numStr = t.nomor.slice(prefix.length);
          const num = parseInt(numStr, 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      });
      const sessionNomor = `${prefix}${(maxNum + 1).toString().padStart(4, '0')}`;
      const resLatestItems = await fetch(`${getBaseUrl()}/items`, { method: "GET", headers: getHeaders() });
      const rawLatestItems = await resLatestItems.json();
      const latestItems: InventoryItem[] = Array.isArray(rawLatestItems.data || rawLatestItems) ? (rawLatestItems.data || rawLatestItems) : [];

      const invalidItem = barangMasuk.find((item) => {
        const existingItem = latestItems.find(
          (dbItem) =>
            dbItem.id === item.existingItemId ||
            normalizeKodeBarang(dbItem.serialNumber) === normalizeKodeBarang(item.nomor)
        );

        if (user?.role === "mitra") {
          return (
            !existingItem ||
            !isValidMitraInboundSource(existingItem, user.displayName)
          );
        }

        if (item.existingItemId && !existingItem) return true;
        if (existingItem && normalizeStatus(existingItem.status) !== "keluar" && normalizeStatus(existingItem.status) !== "diluar") {
          return item.lokasi.trim().toLowerCase() === (existingItem.lokasiPenyimpanan || "").trim().toLowerCase();
        }
        return false;
      });

      if (invalidItem) {
        const existingItem = latestItems.find(
          (dbItem) =>
            dbItem.id === invalidItem.existingItemId ||
            normalizeKodeBarang(dbItem.serialNumber) === normalizeKodeBarang(invalidItem.nomor)
        );

        toast.error(
          user?.role === "mitra"
            ? existingItem
              ? `Barang belum bisa diterima — masih berstatus "${existingItem.status}" di "${existingItem.lokasiPenyimpanan || "gudang KP"}". Scan keluar dari KP terlebih dahulu.`
              : "Barang tidak ditemukan di data KP. Hubungi Admin untuk mendaftarkan barang ini."
            : existingItem
              ? normalizeStatus(existingItem.status) !== "keluar" && normalizeStatus(existingItem.status) !== "diluar"
                ? "Barang sudah berstatus Tersedia di lokasi tersebut dan tidak dapat dimasukkan kembali kecuali pindah penyimpanan."
                : "Barang tidak dapat diproses sebagai masuk kembali."
              : "Data barang keluar tidak lagi ditemukan.",
          {
            description: existingItem
              ? `${invalidItem.nomor} berstatus ${existingItem.status} pada ${existingItem.mitra || "KP Tasikmalaya"}`
              : invalidItem.nomor,
          }
        );
        setDbItems(latestItems);
        return;
      }

      for (const item of barangMasuk) {
        const existingItem = latestItems.find(
          (dbItem) =>
            dbItem.id === item.existingItemId ||
            normalizeKodeBarang(dbItem.serialNumber) === normalizeKodeBarang(item.nomor)
        );

        if (user?.role === "mitra" && !existingItem) {
          throw new Error(
            `${item.nomor} tidak ditemukan di KP dan tidak dapat dibuat oleh Mitra.`
          );
        }

        if (existingItem) {
          const updatedItem: InventoryItem = {
            ...existingItem,
            serialNumber: item.nomor,
            kategori: item.kategori,
            merek: item.merek,
            tipe: item.tipe || undefined,
            status: "Tersedia",
            lokasiPenyimpanan: item.lokasi,
            tanggalMasuk: sessionDate,
            tanggalKeluar: undefined,
            mitra:
              user?.role === "mitra"
                ? user.displayName
                : "KP Tasikmalaya",
          };
          const resUp = await fetch(`${getBaseUrl()}/items/${updatedItem.id}`, {
            method: "PUT",
            headers: getHeaders(),
            body: JSON.stringify(updatedItem),
          });
          if (!resUp.ok) throw new Error(`Gagal update item ${item.nomor}`);
        } else {
          const newItem: InventoryItem = {
            id: crypto.randomUUID(),
            serialNumber: item.nomor,
            kategori: item.kategori,
            merek: item.merek,
            tipe: item.tipe || undefined,
            status: "Tersedia",
            lokasiPenyimpanan: item.lokasi,
            tanggalMasuk: sessionDate,
            mitra:
              user?.role === "mitra"
                ? user.displayName
                : "KP Tasikmalaya",
          };
          const resAdd = await fetch(`${getBaseUrl()}/items`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(newItem),
          });
          if (!resAdd.ok) throw new Error(`Gagal menambah item ${item.nomor}`);
        }

        const newTransaction = {
          id: `TRX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          tanggal: sessionDate,
          nomor: sessionNomor,
          kategori: "Masuk",
          status: "Selesai",
          sn: item.nomor,
          merek: item.merek,
          asal: item.asal || asalBarang,
          tujuan: item.lokasi,
          mitra:
            user?.role === "mitra"
              ? user.displayName
              : "KP Tasikmalaya",
          keterangan: item.kondisi || kondisiBarang,
        };
        const resAddTrx = await fetch(`${getBaseUrl()}/transactions`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(newTransaction),
        });
        if (!resAddTrx.ok) throw new Error(`Gagal mencatat transaksi ${item.nomor}`);
      }
      toast.success(`${barangMasuk.length} barang masuk berhasil disimpan.`);
      setBarangMasuk([]); // Clear local state after saving

      const resRefresh = await fetch(`${getBaseUrl()}/items`, { method: "GET", headers: getHeaders() });
      const rawRefresh = await resRefresh.json();
      setDbItems(Array.isArray(rawRefresh.data || rawRefresh) ? (rawRefresh.data || rawRefresh) : []);
    } catch (error) {
      console.error("Gagal menyimpan ke database:", error);
      toast.error("Gagal menyimpan barang masuk ke database.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="@container/main flex h-full select-none flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="grid h-full gap-4 px-4 lg:px-6 @5xl/main:grid-cols-[minmax(320px,380px)_1fr]">
        <Card className="@container/card flex flex-col @5xl/main:min-h-[calc(107svh-var(--header-height)-15rem)]">
          <Tabs
            value={kondisiBarang}
            onValueChange={(value) => {
              setKondisiBarang(value);
              focusKodeBarangInput();
            }}
            className="flex flex-1 flex-col gap-4"
          >
            <CardHeader className="flex flex-col gap-4 pb-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="Baru" className="gap-2">
                  Baru
                </TabsTrigger>
                <TabsTrigger value="Dismantle" className="gap-2">
                  Dismantle
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col gap-4">
              {user?.role === "mitra" && (
                <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2.5 text-xs leading-5 text-sky-600 dark:text-sky-400 space-y-1">
                  <p className="font-semibold">Ketentuan Penerimaan Barang Mitra</p>
                  <p>Barang hanya dapat diterima jika sudah berstatus <span className="font-semibold">Keluar</span> atau <span className="font-semibold">Diluar</span> dari KP. Barang yang masih tersimpan di gudang KP tidak dapat dipindah ke gudang mitra.</p>
                </div>
              )}

              {user?.role !== "mitra" && (
                <div className="flex flex-col gap-3">
                  <Label htmlFor="asal-barang">Asal Barang</Label>
                  <Select
                    value={asalBarang}
                    onValueChange={(value) => {
                      setAsalBarang(value);
                      setAsalBarangManual(true);
                      focusKodeBarangInput();
                    }}
                  >
                    <SelectTrigger id="asal-barang" className="w-full">
                      <SelectValue placeholder="Pilih asal barang..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SBU Regional Jawa Barat">SBU Regional Jawa Barat</SelectItem>
                      {dbPartners.map((partner) => (
                        <SelectItem key={partner.id} value={partner.name}>
                          {partner.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!asalBarangManual && detectMitraFromSN(kodeBarang, dbPartners) && (
                    <p className="text-xs text-sky-600 dark:text-sky-400">
                      Terdeteksi otomatis dari SN
                    </p>
                  )}
                </div>
              )}

              <div className="my-2 border-t border-dashed"></div>

              <div className="flex flex-col gap-3">

                {kondisiBarang === "Baru" && (
                  <div className="space-y-1.5 mb-1">
                    <Label htmlFor="tipe-barang">Model</Label>
                    <Popover open={openModelPopover} onOpenChange={setOpenModelPopover}>
                      <PopoverTrigger asChild>
                        <Button
                          id="tipe-barang"
                          variant="outline"
                          role="combobox"
                          aria-expanded={openModelPopover}
                          className="w-full justify-between h-10 px-3 font-normal text-muted-foreground bg-background hover:bg-background"
                        >
                          <span className="truncate text-foreground text-xs font-medium">
                            {tipeBarang
                              ? (() => {
                                const found = dbModels.find((m) => m.nama === tipeBarang);
                                const brandName = found?.brand?.nama || found?.brand?.name;
                                return brandName ? `${tipeBarang} (${brandName})` : tipeBarang;
                              })()
                              : "Pilih Model Default (Opsional)"}
                          </span>
                          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50 text-muted-foreground" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <div className="p-2 border-b">
                          <div className="flex items-center gap-2 px-2.5 py-1.5 border rounded-md bg-muted/20">
                            <Search className="size-3.5 text-muted-foreground shrink-0" />
                            <input
                              className="w-full text-xs bg-transparent outline-none placeholder:text-muted-foreground"
                              placeholder="Cari nama model / merek..."
                              value={modelSearch}
                              onChange={(e) => setModelSearch(e.target.value)}
                            />
                            {modelSearch && (
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground text-xs"
                                onClick={() => setModelSearch("")}
                              >
                                <X className="size-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="max-h-56 overflow-y-auto p-2 text-xs">
                          {filteredModels.length === 0 ? (
                            <div className="p-3 text-center text-muted-foreground">Model tidak ditemukan</div>
                          ) : (
                            filteredModels.map((model) => {
                              const isSelected = tipeBarang === model.nama;
                              return (
                                <div
                                  key={model.id}
                                  className={`flex items-center justify-between px-2.5 py-2 rounded cursor-pointer hover:bg-accent transition-colors ${isSelected ? "bg-accent font-semibold text-primary" : ""
                                    }`}
                                  onClick={() => {
                                    setTipeBarang(model.nama);
                                    setOpenModelPopover(false);
                                    setModelSearch("");
                                    focusKodeBarangInput();
                                  }}
                                >
                                  <span>
                                    {model.nama}
                                  </span>
                                  {isSelected && <Check className="size-4 text-primary shrink-0" />}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                <Label htmlFor="kode-barang-manual">Kode / SN</Label>

                <Input
                  ref={inputRef}
                  id="kode-barang-manual"
                  value={kodeBarang}
                  onChange={(event) => updateKodeBarang(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleSubmit(kodeBarangRef.current);
                    }
                  }}
                  placeholder="Scan barcode atau ketik manual di sini..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Kategori dan Merek akan terdeteksi otomatis dari SN.
                </p>
              </div>
            </CardContent>
          </Tabs>
        </Card>

        <Card className="@container/card flex flex-col @5xl/main:min-h-[calc(100svh-var(--header-height)-15rem)]">
          <CardHeader className="flex flex-col gap-3 border-b pb-4 @lg/card:flex-row @lg/card:items-center @lg/card:justify-between">
            <div className="space-y-1">
              <CardTitle>Daftar Barang Masuk</CardTitle>
            </div>
            <Badge variant="outline" className="w-fit">
              {barangMasuk.length} Item
            </Badge>
          </CardHeader>

          <CardContent className="flex flex-1 flex-col gap-4">
            <div className="flex-1 overflow-auto rounded-lg border max-h-[calc(100vh-22rem)]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted">
                  <TableRow>
                    <TableHead className="w-14">No</TableHead>
                    <TableHead>Serial Number</TableHead>
                    <TableHead>Merek</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Model Material</TableHead>
                    <TableHead>Asal</TableHead>
                    <TableHead>Lokasi</TableHead>
                    <TableHead className="w-16 text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {barangMasuk.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="p-0">
                        <EmptyScanTableState />
                      </TableCell>
                    </TableRow>
                  ) : (
                    barangMasuk.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell className="font-mono">{item.nomor}</TableCell>
                        <TableCell>
                          {item.kondisi === "Baru" ? (
                            <Select value={item.merek} onValueChange={(val) => handleUpdateInline(item.id, "merek", val)}>
                              <SelectTrigger className="w-30 h-8 text-xs"><SelectValue placeholder="Pilih Merek" /></SelectTrigger>
                              <SelectContent>
                                {dbBrands.map(b => <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="flex items-center gap-1.5"><Lock className="size-3 text-muted-foreground" />{item.merek}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.kondisi === "Baru" ? (
                            <Select value={item.kategori} onValueChange={(val) => handleUpdateInline(item.id, "kategori", val)}>
                              <SelectTrigger className="w-30 h-8 text-xs"><SelectValue placeholder="Pilih Kategori" /></SelectTrigger>
                              <SelectContent>
                                {dbCategories.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="secondary" className="font-normal px-2.5 py-0.5 flex w-fit items-center gap-1.5"><Lock className="size-3 text-muted-foreground" />{item.kategori}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.kondisi === "Baru" ? (
                            <Select value={item.tipe} onValueChange={(val) => handleUpdateInline(item.id, "tipe", val)}>
                              <SelectTrigger className={`w-[140px] h-8 text-xs ${!item.tipe ? "border-destructive text-destructive" : ""}`}><SelectValue placeholder="Pilih Model" /></SelectTrigger>
                              <SelectContent>
                                {dbModels.filter(m => (m.brand?.nama || m.brand?.name || "").toLowerCase() === item.merek.toLowerCase()).map(m => <SelectItem key={m.id} value={m.nama}>{m.nama}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="flex items-center gap-1.5"><Lock className="size-3 text-muted-foreground" />{item.tipe || "-"}</div>
                          )}
                        </TableCell>
                        <TableCell>{item.asal || asalBarang}</TableCell>
                        <TableCell>
                          <Select
                            value={item.lokasi}
                            onValueChange={(value) => {
                              const selectedLokasi = value as LokasiOption;
                              if ((kuota[selectedLokasi] ?? Number.POSITIVE_INFINITY) <= 0) {
                                toast.error("Kuota lokasi sudah penuh dan tidak dapat dipilih.", {
                                  description: selectedLokasi,
                                });
                                focusKodeBarangInput();
                                return;
                              }
                              handleUpdateLokasi(item.id, selectedLokasi);
                              focusKodeBarangInput();
                            }}
                          >
                            <SelectTrigger className="w-220px">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {!dbLocations.some((lokasi) => lokasi.name === item.lokasi) && (
                                  <SelectItem value={item.lokasi}>
                                    {item.lokasi}
                                  </SelectItem>
                                )}
                                {dbLocations.map((lokasi) => {
                                  const isDisabled = kuota[lokasi.name] <= 0;
                                  return (
                                    <SelectItem
                                      key={lokasi.name}
                                      value={lokasi.name}
                                      disabled={isDisabled}
                                    >
                                      {lokasi.name}{isDisabled ? " (Kuota penuh)" : ""}
                                    </SelectItem>
                                  );
                                })}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            <X className="size-4" />
                            <span className="sr-only">Hapus item</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>

          <CardFooter className="justify-end gap-2">
            <Button
              className="w-full gap-2 sm:w-auto"
              size="lg"
              onClick={handleValidateAll}
              disabled={barangMasuk.length === 0 || isSaving}
            >
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
              Simpan Semua
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
