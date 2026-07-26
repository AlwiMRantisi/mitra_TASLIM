import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useInboundSession } from "./useInboundSession";
import { useBarcodeScanner } from "./useBarcodeScanner";
import { fetchBarangMasukMasterData, getBaseUrl, getHeaders, fetchInventoryItems } from "../api/barangMasukApi";
import { detectBrandFromCode, detectMitraFromSN } from "../utils/brandDetector";
import { getRecommendedLocation, getMitraDefaultLocation, calculateCapacityMap } from "../utils/locationSmartRouting";
import { isValidMitraInboundSource, normalizeKodeBarang, normalizeStatus, normalizeOwner } from "../utils/validators";
import type { BrandDefinition, LocationDefinition, InventoryItem } from "@/types/inventory";
import type { Partner } from "@/types/partner";
import type { BarangMasukItem } from "@/types/transaction";

export function useBarangMasukLogic() {
  const { user } = useAuth();
  
  // Master data
  const [dbBrands, setDbBrands] = useState<BrandDefinition[]>([]);
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [dbModels, setDbModels] = useState<any[]>([]);
  const [dbLocations, setDbLocations] = useState<LocationDefinition[]>([]);
  const [, setDbItems] = useState<InventoryItem[]>([]);
  const [dbPartners, setDbPartners] = useState<Partner[]>([]);

  // Form state
  const [kodeBarang, setKodeBarang] = useState("");
  const [asalBarang, setAsalBarang] = useState<string>("SBU Regional Jawa Barat");
  const [asalBarangManual, setAsalBarangManual] = useState<boolean>(false);
  const [itemCondition, setItemCondition] = useState<"baru" | "dismantle" | "rusak">("baru");
  const [catatan, setCatatan] = useState<string>("");
  const [tipeBarang, setTipeBarang] = useState<string>("");
  const [brand, setBrand] = useState<string>("");
  const [kategori, setKategori] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const kodeBarangRef = useRef("");

  const session = useInboundSession();

  const updateKodeBarang = useCallback((value: string | ((current: string) => string)) => {
    const nextValue = typeof value === "function" ? value(kodeBarangRef.current) : value;
    kodeBarangRef.current = nextValue;
    setKodeBarang(nextValue);
  }, []);

  const focusKodeBarangInput = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const refreshItems = useCallback(async () => {
    const items = await fetchInventoryItems();
    setDbItems(items);
    return items;
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await fetchBarangMasukMasterData();
        setDbPartners(data.partners);
        setDbBrands(data.brands);
        setDbCategories(data.categories);
        setDbModels(data.models);
        setDbItems(data.items);
        
        const locationOwner = user?.role === "mitra" ? (user.displayName || "") : "KP Tasikmalaya";
        const { locs, newKuota } = calculateCapacityMap(data.locations, data.items, locationOwner);
        setDbLocations(locs);
        session.setKuota(newKuota);
      } catch (error) {
        toast.error("Gagal memuat data barang masuk.");
      }
    };
    void fetchData();
  }, [user, session.setKuota]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshItems();
      }
    };
    window.addEventListener("focus", handleVisibilityChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", handleVisibilityChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshItems]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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

    const isDuplicate = session.barangMasuk.some(
      (item) => normalizeKodeBarang(item.nomor) === normalizeKodeBarang(trimmedKode)
    );

    if (isDuplicate) {
      toast.error("Serial number sudah ada di sesi ini.", { description: trimmedKode });
      updateKodeBarang("");
      focusKodeBarangInput();
      return;
    }

    const latestItems = await refreshItems();
    const existingItem = latestItems.find(
      (item) => normalizeKodeBarang(item.serialNumber) === normalizeKodeBarang(trimmedKode)
    );

    if (user?.role === "mitra" && !existingItem) {
      toast.error("Barang belum terdaftar di KP.", { description: `${trimmedKode} harus didaftarkan oleh Admin terlebih dahulu.` });
      updateKodeBarang("");
      focusKodeBarangInput();
      return;
    }

    if (user?.role === "mitra" && existingItem && !isValidMitraInboundSource(existingItem, user.displayName || "")) {
      const status = existingItem.status || "tidak diketahui";
      const lokasi = existingItem.lokasiPenyimpanan || "gudang KP";
      toast.error("Barang belum bisa diterima.", {
        description: `${trimmedKode} masih berstatus "${status}" di "${lokasi}". Barang harus sudah keluar dari KP terlebih dahulu.`,
      });
      updateKodeBarang("");
      focusKodeBarangInput();
      return;
    }

    if (!existingItem && !tipeBarang) {
      toast.error("Model wajib dipilih.", { description: "SN ini belum terdaftar di database. Pilih Model terlebih dahulu." });
      focusKodeBarangInput();
      return;
    }

    if (itemCondition === "baru") {
      if (existingItem) {
        toast.error("Barang sudah ada di database.", { description: "SN ini sudah terdaftar. Silakan ubah kondisi ke 'dismantle' atau 'rusak'." });
        updateKodeBarang("");
        focusKodeBarangInput();
        return;
      }
    } else if (itemCondition === "dismantle" || itemCondition === "rusak") {
      if (itemCondition === "rusak" && catatan.trim() === "") {
        toast.error("Catatan wajib diisi untuk barang rusak.", { description: "Isi deskripsi kerusakan sebelum scan barang." });
        focusKodeBarangInput();
        return;
      }
    }

    const selectedModelInfo = !existingItem && tipeBarang
      ? dbModels.find((m) => m.nama === tipeBarang)
      : null;

    const itemBrand =
      existingItem?.merek ||
      brand ||
      (selectedModelInfo?.brand?.nama || selectedModelInfo?.brand?.name) ||
      detectBrandFromCode(trimmedKode, dbBrands) ||
      "";

    let recommendedLocation = getRecommendedLocation(itemBrand, dbLocations, session.kuota);
    const isMitraUser = user?.role === "mitra";

    if (isMitraUser && !recommendedLocation && existingItem) {
      recommendedLocation = getMitraDefaultLocation(user.displayName || "");
    }

    if (!isMitraUser && existingItem && normalizeStatus(existingItem.status) !== "keluar" && normalizeStatus(existingItem.status) !== "diluar") {
      if (recommendedLocation && recommendedLocation.trim().toLowerCase() === (existingItem.lokasiPenyimpanan || "").trim().toLowerCase()) {
        const alternativeLocation = dbLocations.find(
          (loc) => (session.kuota[loc.name] ?? 0) > 0 && loc.name.trim().toLowerCase() !== (existingItem.lokasiPenyimpanan || "").trim().toLowerCase()
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
      toast.error(dbLocations.length === 0 ? "Tidak ada lokasi penyimpanan aktif yang tersedia." : "Semua lokasi penyimpanan sudah penuh.");
      focusKodeBarangInput();
      return;
    }

    const isDismantleBad = itemCondition === "rusak";
    const isdismantle = itemCondition === "dismantle" || itemCondition === "rusak";
    const dismantleEffectiveTipe = existingItem?.tipe || tipeBarang || "";
    const dismantleEffectiveMerek = existingItem?.merek || itemBrand || "";
    const dismantleEffectiveKategori = existingItem?.kategori || "ONT";

    const newItem: BarangMasukItem = {
      id: Date.now(),
      nomor: trimmedKode,
      merek: isdismantle ? dismantleEffectiveMerek : (itemBrand || ""),
      kategori: isdismantle ? dismantleEffectiveKategori : (kategori || "ONT"),
      tipe: isdismantle ? dismantleEffectiveTipe : (itemCondition === "baru" ? tipeBarang : ""),
      lokasi: recommendedLocation,
      status: isDismantleBad ? "Rusak" : "Valid",
      existingItemId: existingItem?.id,
      source:
        user?.role === "mitra" && existingItem && isValidMitraInboundSource(existingItem, user.displayName || "")
          ? "KP"
          : normalizeOwner(existingItem?.mitra) === normalizeOwner("KP Tasikmalaya")
            ? "KP"
            : existingItem
              ? "Mitra"
              : "Baru",
      asal: asalBarang,
      kondisi: itemCondition === "rusak" ? "Rusak" : "Bagus",
      catatan: isDismantleBad ? catatan : undefined,
    };

    session.addItem(newItem);
    session.setKuota((current) => ({
      ...current,
      [recommendedLocation]: current[recommendedLocation] - 1,
    }));

    updateKodeBarang("");
    setAsalBarangManual(false);
    focusKodeBarangInput();
  }, [
    session,
    dbBrands,
    dbLocations,
    refreshItems,
    focusKodeBarangInput,
    kodeBarang,
    updateKodeBarang,
    user,
    asalBarang,
    itemCondition,
    asalBarangManual,
    catatan,
    dbModels,
    tipeBarang,
    brand,
    kategori
  ]);

  useBarcodeScanner({
    inputRef,
    kodeBarangRef,
    updateKodeBarang,
    onSubmit: handleSubmit,
  });

  const handleValidateAll = async () => {
    if (isSaving) return;

    const hasIncompleteNewItems = session.barangMasuk.some(
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
      const latestItems = await refreshItems();

      const invalidItem = session.barangMasuk.find((item) => {
        const existingItem = latestItems.find(
          (dbItem) =>
            dbItem.id === item.existingItemId ||
            normalizeKodeBarang(dbItem.serialNumber) === normalizeKodeBarang(item.nomor)
        );

        if (user?.role === "mitra") {
          return !existingItem || !isValidMitraInboundSource(existingItem, user.displayName || "");
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
        return;
      }

      for (const item of session.barangMasuk) {
        const existingItem = latestItems.find(
          (dbItem) =>
            dbItem.id === item.existingItemId ||
            normalizeKodeBarang(dbItem.serialNumber) === normalizeKodeBarang(item.nomor)
        );

        if (user?.role === "mitra" && !existingItem) {
          throw new Error(`${item.nomor} tidak ditemukan di KP dan tidak dapat dibuat oleh Mitra.`);
        }

        const itemStatus = item.status === "Rusak" ? "Rusak" : "Tersedia";
        if (existingItem) {
          const updatedItem: InventoryItem = {
            ...existingItem,
            serialNumber: item.nomor,
            kategori: item.kategori,
            merek: item.merek,
            tipe: item.tipe || undefined,
            status: itemStatus,
            lokasiPenyimpanan: item.lokasi,
            tanggalMasuk: sessionDate,
            tanggalKeluar: undefined,
            mitra: user?.role === "mitra" ? (user.displayName || "") : "KP Tasikmalaya",
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
            status: itemStatus,
            lokasiPenyimpanan: item.lokasi,
            tanggalMasuk: sessionDate,
            mitra: user?.role === "mitra" ? (user.displayName || "") : "KP Tasikmalaya",
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
          mitra: user?.role === "mitra" ? (user.displayName || "") : "KP Tasikmalaya",
          keterangan: item.catatan ? `${item.kondisi}: ${item.catatan}` : `${item.kondisi}`,
        };
        const resAddTrx = await fetch(`${getBaseUrl()}/transactions`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(newTransaction),
        });
        if (!resAddTrx.ok) throw new Error(`Gagal mencatat transaksi ${item.nomor}`);
      }
      toast.success(`${session.barangMasuk.length} barang masuk berhasil disimpan.`);
      session.clearSession();
      await refreshItems();
    } catch (error) {
      console.error("Gagal menyimpan ke database:", error);
      toast.error("Gagal menyimpan barang masuk ke database.");
    } finally {
      setIsSaving(false);
    }
  };

  return {
    user,
    session,
    dbBrands,
    dbCategories,
    dbModels,
    dbLocations,
    dbPartners,
    kodeBarang,
    updateKodeBarang,
    asalBarang,
    setAsalBarang,
    asalBarangManual,
    setAsalBarangManual,
    itemCondition,
    setItemCondition,
    tipeBarang,
    setTipeBarang,
    brand,
    setBrand,
    kategori,
    setKategori,
    catatan,
    setCatatan,
    isSaving,
    inputRef,
    kodeBarangRef,
    handleSubmit,
    handleValidateAll,
    focusKodeBarangInput,
  };
}
