import { useState, useEffect, useRef, useCallback } from "react";
import { Archive, BadgeCheck, Boxes, PackageMinus, ScanLine, X, Loader2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
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
import {
  Select,
  SelectContent,
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
import type { LokasiOption, InventoryItem, KodeBarangUpdate } from "@/types/inventory";
import type { Partner } from "@/types/partner";
import type { BarangKeluarItem } from "@/types/transaction";

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

/**
 * Mengecek apakah event berasal dari elemen input teks, textarea, atau konten editable.
 * Berguna agar global keyboard listener (scanner) tidak membajak input pengguna saat mereka mengetik manual.
 */
const isTextInputTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, [contenteditable='true']"));
};

const ADMIN_LOCATION = "KP Tasikmalaya";

const normalizeKodeBarang = (code?: string | null) => (code || "").trim().toUpperCase();
const normalizeStatus = (status: string) => status.trim().toLocaleLowerCase("id-ID");
const normalizeText = (text?: string | null) => (text || "").trim().toLocaleLowerCase("id-ID");
const normalizeOwner = (owner?: string | null) => normalizeText(owner || ADMIN_LOCATION);
const isOutsideStatus = (status: string) => {
  const normalizedStatus = normalizeStatus(status);
  return normalizedStatus === "keluar" || normalizedStatus === "diluar";
};

const getEntryDateTime = (item: InventoryItem) => {
  const parsedTime = Date.parse(item.tanggalMasuk);
  return Number.isFinite(parsedTime) ? parsedTime : Number.MAX_SAFE_INTEGER;
};

const compareFifoItems = (a: InventoryItem, b: InventoryItem) => {
  const dateDiff = getEntryDateTime(a) - getEntryDateTime(b);
  if (dateDiff !== 0) return dateDiff;

  return normalizeKodeBarang(a.serialNumber).localeCompare(normalizeKodeBarang(b.serialNumber));
};

const isSameFifoGroup = (item: InventoryItem, referenceItem: InventoryItem) =>
  normalizeText(item.merek) === normalizeText(referenceItem.merek) &&
  normalizeText(item.kategori) === normalizeText(referenceItem.kategori) &&
  normalizeOwner(item.mitra) === normalizeOwner(referenceItem.mitra);

const getQueuedSerialNumbers = (items: BarangKeluarItem[]) =>
  new Set(items.map((item) => normalizeKodeBarang(item.nomor)).filter(Boolean));

const findOlderFifoItem = (
  items: InventoryItem[],
  requestedItem: InventoryItem,
  queuedSerialNumbers: Set<string>
) => {
  const requestedSerial = normalizeKodeBarang(requestedItem.serialNumber);
  const requestedEntryTime = getEntryDateTime(requestedItem);

  return items
    .filter((item) => {
      const itemSerial = normalizeKodeBarang(item.serialNumber);
      return (
        itemSerial &&
        itemSerial !== requestedSerial &&
        !queuedSerialNumbers.has(itemSerial) &&
        !isOutsideStatus(item.status) &&
        isSameFifoGroup(item, requestedItem) &&
        getEntryDateTime(item) < requestedEntryTime
      );
    })
    .sort(compareFifoItems)[0];
};

const formatTanggalMasuk = (tanggal: string) => {
  if (!tanggal) return "tanggal masuk belum tersedia";

  const [datePart] = tanggal.split("T");
  return datePart || tanggal;
};

const getFifoToastDescription = (olderItem: InventoryItem) =>
  `Scan ${olderItem.serialNumber} terlebih dahulu (masuk ${formatTanggalMasuk(
    olderItem.tanggalMasuk
  )}, lokasi ${olderItem.lokasiPenyimpanan || "-"}).`;

function EmptyScanTableState() {
  return (
    <div className="flex items-center justify-center px-6 py-12">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
          <PackageMinus className="size-7" strokeWidth={1.8} />
        </div>
        <div className="space-y-1.5">
          <p className="text-base font-semibold text-foreground">Belum ada barang keluar</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Scan atau masukkan serial number dari form di sebelah kiri untuk menambahkan item ke sesi keluar.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Komponen BarangKeluarPage
 * 
 * Modul operasional Gudang untuk mencatat pengeluaran barang.
 * Mendukung input via Barcode Scanner (auto) dan input manual.
 * Terintegrasi penuh dengan pengecekan master data, status inventaris, dan limit kuota.
 * 
 * @returns {JSX.Element} Antarmuka halaman barang keluar.
 */
export default function BarangKeluarPage() {
  const { user } = useAuth();
  const [kodeBarang, setKodeBarang] = useState("");
  const [inputMode, setInputMode] = useState<"auto" | "manual">("auto");
  const [barangKeluar, setBarangKeluar] = useState<BarangKeluarItem[]>([]);
  const [kuota, setKuota] = useState<Record<string, number>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const kodeBarangRef = useRef("");
  const [dbItems, setDbItems] = useState<InventoryItem[]>([]);
  const [dbPartners, setDbPartners] = useState<Partner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchItemsAndLocations = async () => {
      try {
        const resItems = await fetch(`${getBaseUrl()}/items`, { method: "GET", headers: getHeaders() });
        const rawItems = await resItems.json();
        const items: InventoryItem[] = Array.isArray(rawItems.data || rawItems) ? (rawItems.data || rawItems) : [];
        setDbItems(
          user?.role === "mitra"
            ? items.filter((item) => {
              if (!item.mitra) return false
              const itemMitra = item.mitra.trim().toLowerCase()
              return (
                itemMitra === user.displayName.trim().toLowerCase() ||
                itemMitra === user.username.trim().toLowerCase() ||
                (user.identityCode &&
                  itemMitra.includes(user.identityCode.trim().toLowerCase()))
              )
            })
            : items
        );

        if (user?.role === "mitra") {
          setDbPartners([]);
          setSelectedPartnerId("");
        } else {
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
          const activePartners = partners.filter((partner) => partner.isActive);
          setDbPartners(activePartners);
          if (activePartners.length === 1) {
            setSelectedPartnerId(activePartners[0].id);
          }
        }

        const resLoc = await fetch(`${getBaseUrl()}/locations`, { method: "GET", headers: getHeaders() });
        const rawLoc = await resLoc.json();
        const locationsData = rawLoc.data || rawLoc;
        const newKuota: Record<string, number> = {};
        const locationOwner =
          user?.role === "mitra" ? user.displayName : "KP Tasikmalaya";

        (Array.isArray(locationsData) ? locationsData : []).forEach((loc: any) => {
          if (loc.name === "Keluar" || loc.name === "Diluar") return;
          if (
            (loc.owner || "KP Tasikmalaya").trim().toLowerCase() !==
            locationOwner.trim().toLowerCase()
          ) {
            return;
          }

          if (loc.type === "Rak" && loc.levels) {
            loc.levels.forEach((lvl: any) => {
              const name = `${loc.name} - ${lvl.name}`;
              const actualUsed = (Array.isArray(items) ? items : []).filter((item: any) => {
                if (!item.lokasiPenyimpanan) return false;
                const st = (item.status || "").trim().toLowerCase();
                return item.lokasiPenyimpanan.trim() === name.trim() && st !== "diluar" && st !== "keluar";
              }).length;
              newKuota[name] = Math.max(0, lvl.capacity - actualUsed);
            });
          } else {
            const actualUsed = (Array.isArray(items) ? items : []).filter((item: any) => {
              if (!item.lokasiPenyimpanan) return false;
              const st = (item.status || "").trim().toLowerCase();
              return item.lokasiPenyimpanan.trim() === loc.name.trim() && st !== "diluar" && st !== "keluar";
            }).length;
            newKuota[loc.name] = Math.max(0, (loc.capacity || 0) - actualUsed);
          }
        });
        setKuota(newKuota);
      } catch (error) {
        console.error("Gagal mengambil data dari server:", error);
        toast.error("Gagal memuat data barang keluar.");
      }
    };
    fetchItemsAndLocations();
  }, [user]);
  const totalKuotaTersedia = Object.values(kuota).reduce((total, value) => total + value, 0);
  const validItems = barangKeluar.filter((item) => item.status === "Valid").length;

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
   * Melakukan serangkaian validasi (keberadaan di master data, status saat ini, dan duplikasi sesi).
   * 
   * @param {string} kodeOverride - Kode serial number spesifik (jika ada) untuk di-submit.
   */
  const handleSubmit = useCallback((kodeOverride = kodeBarang) => {
    const trimmedKode = kodeOverride.trim();
    if (!trimmedKode) return;

    const selectedPartner =
      user?.role === "mitra"
        ? null
        : dbPartners.find((partner) => partner.id === selectedPartnerId);
    const targetMitraName =
      user?.role === "mitra" ? user.displayName : selectedPartner?.name;

    if (!targetMitraName) {
      toast.error("Pilih mitra tujuan sebelum menambahkan barang keluar.");
      focusKodeBarangInput();
      return;
    }

    if (user?.role === "mitra" && !keterangan.trim()) {
      toast.error("PA / keterangan wajib diisi sebelum menambahkan barang keluar.");
      focusKodeBarangInput();
      return;
    }

    const isDuplicate = barangKeluar.some(
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

    // Periksa apakah kode yang discan ada di data master (SQLite)
    const matchedItem = dbItems.find(
      (item) => normalizeKodeBarang(item.serialNumber) === normalizeKodeBarang(trimmedKode)
    );

    if (!matchedItem) {
      toast.error("Data serial number tidak ditemukan.", {
        description: trimmedKode,
      });
      updateKodeBarang("");
      focusKodeBarangInput();
      return;
    }

    if (isOutsideStatus(matchedItem.status)) {
      toast.error("Barang ini sudah berada di luar dan tidak dapat dikeluarkan kembali.", {
        description: `Status saat ini: ${matchedItem.status}`,
      });
      updateKodeBarang("");
      focusKodeBarangInput();
      return;
    }

    const queuedSerialNumbers = getQueuedSerialNumbers(barangKeluar);
    const olderFifoItem = findOlderFifoItem(dbItems, matchedItem, queuedSerialNumbers);

    if (olderFifoItem) {
      toast.error("FIFO aktif: keluarkan barang yang lebih lama terlebih dahulu.", {
        description: getFifoToastDescription(olderFifoItem),
      });
      updateKodeBarang("");
      focusKodeBarangInput();
      return;
    }

    const originalLoc = matchedItem.lokasiPenyimpanan || "-";

    const newItem: BarangKeluarItem = {
      id: Date.now(),
      nomor: trimmedKode,
      merek: matchedItem.merek || "-",
      kategori: matchedItem.kategori || "-",
      tipe: matchedItem.tipe || undefined,
      lokasi: originalLoc as LokasiOption,
      mitra: targetMitraName,
      keterangan: user?.role === "mitra" ? keterangan.trim() : "",
      status: "Valid",
    };

    setBarangKeluar((current) => [newItem, ...current]);
    // Tambah kuota lokasi karena barang keluar
    setKuota((current) => ({
      ...current,
      [originalLoc]: (current[originalLoc as LokasiOption] || 0) + 1,
    }));

    updateKodeBarang("");

    // Auto-focus kembali ke input setelah submit
    focusKodeBarangInput();
  }, [
    barangKeluar,
    dbItems,
    dbPartners,
    focusKodeBarangInput,
    kodeBarang,
    keterangan,
    kuota,
    selectedPartnerId,
    updateKodeBarang,
    user,
  ]);

  /**
   * Mengarahkan input keyboard atau barcode scanner ke field Kode/SN secara otomatis.
   * Listener global ini memungkinkan user melakukan "blind scan" tanpa harus
   * secara eksplisit mengklik kolom input terlebih dahulu.
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

      if (document.querySelector("[data-slot='select-content']")) {
        return;
      }

      event.preventDefault();
      inputRef.current?.focus();

      if (event.key === "Enter") {
        handleSubmit(kodeBarangRef.current);
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
    const itemToDelete = barangKeluar.find((item) => item.id === id);
    if (itemToDelete) {
      // Kurangi kembali kuota lokasi karena batal dikeluarkan
      setKuota((current) => ({
        ...current,
        [itemToDelete.lokasi]: (current[itemToDelete.lokasi] || 0) - 1,
      }));
    }
    setBarangKeluar((current) => current.filter((item) => item.id !== id));
  };

  /**
   * Memvalidasi seluruh transaksi di sesi saat ini ke database dan melakukan update status inventaris.
   * Transaksi dicatat pada histori ('transactions') dan status item ('items') diubah menjadi "Diluar".
   */
  const handleValidateAll = async () => {
    if (isSaving) return;
    if (user?.role === "mitra" && !keterangan.trim()) {
      toast.error("PA / keterangan wajib diisi sebelum transaksi disimpan.");
      return;
    }

    setIsSaving(true);
    try {
      const sessionDate = new Date().toISOString().slice(0, 10);
      const dateStr = sessionDate.replace(/-/g, "");

      // Mendapatkan nomor urut (sequence) transaksi harian
      const resTrx = await fetch(`${getBaseUrl()}/transactions`, { method: "GET", headers: getHeaders() });
      const rawTrx = await resTrx.json();
      const txs = rawTrx.data || rawTrx;
      const prefix = `OUT-${dateStr}-`;
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
      const latestVisibleItems =
        user?.role === "mitra"
          ? latestItems.filter((item) => {
            if (!item.mitra) return false
            const itemMitra = normalizeOwner(item.mitra)
            return (
              itemMitra === normalizeOwner(user.displayName) ||
              itemMitra === normalizeOwner(user.username) ||
              (user.identityCode &&
                itemMitra.includes(normalizeOwner(user.identityCode)))
            )
          })
          : latestItems;
      const findLatestSessionItem = (nomor: string) =>
        latestVisibleItems.find(
          (dbItem) => normalizeKodeBarang(dbItem.serialNumber) === normalizeKodeBarang(nomor)
        );

      const invalidItem = barangKeluar.find((item) => {
        const latestItem = findLatestSessionItem(item.nomor);
        return !latestItem || isOutsideStatus(latestItem.status);
      });

      if (invalidItem) {
        const latestItem = findLatestSessionItem(invalidItem.nomor);

        toast.error(
          latestItem
            ? "Barang yang sudah berada di luar tidak dapat dikeluarkan kembali."
            : "Data barang tidak lagi ditemukan di data master.",
          { description: invalidItem.nomor }
        );
        setDbItems(latestVisibleItems);
        return;
      }

      const queuedSerialNumbers = getQueuedSerialNumbers(barangKeluar);
      const fifoInvalidItem = barangKeluar.find((item) => {
        const latestItem = findLatestSessionItem(item.nomor);
        return latestItem
          ? Boolean(findOlderFifoItem(latestVisibleItems, latestItem, queuedSerialNumbers))
          : false;
      });

      if (fifoInvalidItem) {
        const latestItem = findLatestSessionItem(fifoInvalidItem.nomor);
        const olderFifoItem = latestItem
          ? findOlderFifoItem(latestVisibleItems, latestItem, queuedSerialNumbers)
          : undefined;

        toast.error("FIFO aktif: masih ada barang lama yang harus keluar lebih dulu.", {
          description: olderFifoItem
            ? getFifoToastDescription(olderFifoItem)
            : fifoInvalidItem.nomor,
        });
        setDbItems(latestVisibleItems);
        return;
      }

      const fifoSortedBarangKeluar = [...barangKeluar].sort((a, b) => {
        const itemA = findLatestSessionItem(a.nomor);
        const itemB = findLatestSessionItem(b.nomor);

        if (!itemA || !itemB) return 0;

        return compareFifoItems(itemA, itemB);
      });

      for (const item of fifoSortedBarangKeluar) {
        const originalItem = findLatestSessionItem(item.nomor)!;
        const originalLoc = originalItem.lokasiPenyimpanan || "-";
        const updatedItem: InventoryItem = {
          ...originalItem,
          status: "Keluar",
          lokasiPenyimpanan: "Keluar",
          tanggalKeluar: sessionDate,
          mitra: item.mitra,
        };
        const resUp = await fetch(`${getBaseUrl()}/items/${updatedItem.id}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify(updatedItem),
        });
        if (!resUp.ok) throw new Error(`Gagal update item ${item.nomor}`);

        const newTransaction = {
          id: `TRX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          tanggal: sessionDate,
          nomor: sessionNomor,
          kategori: "Keluar",
          status: "Selesai",
          sn: item.nomor,
          merek: item.merek,
          asal: originalLoc,
          tujuan: item.mitra,
          mitra: item.mitra,
          keterangan:
            user?.role === "mitra" ? keterangan.trim() : null,
        };
        const resAddTrx = await fetch(`${getBaseUrl()}/transactions`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(newTransaction),
        });
        if (!resAddTrx.ok) throw new Error(`Gagal mencatat transaksi ${item.nomor}`);
      }
      toast.success(`${barangKeluar.length} barang keluar berhasil disimpan.`);

      if (user?.role === "mitra" && barangKeluar.length > 0) {
        const notificationId = `permintaan-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const requestCount = barangKeluar.length;
        const title = `Permintaan barang mitra ${user.displayName}`;
        const message = `${user.displayName} mengajukan permintaan ${requestCount} barang keluar.${keterangan ? ` Keterangan: ${keterangan}` : ""}`;

        try {
          await invoke("add_notification", {
            notification: {
              id: notificationId,
              title,
              message,
              type: "info",
              date: new Date().toISOString(),
              isRead: false,
            },
          });
        } catch (notificationError) {
          console.error("Gagal membuat notifikasi permintaan:", notificationError);
        }
      }

      setKeterangan("");

      // Refresh DB Items after update
      const resRefresh = await fetch(`${getBaseUrl()}/items`, { method: "GET", headers: getHeaders() });
      const rawRefresh = await resRefresh.json();
      const items: InventoryItem[] = Array.isArray(rawRefresh.data || rawRefresh) ? (rawRefresh.data || rawRefresh) : [];
      setDbItems(
        user?.role === "mitra"
          ? items.filter((item) => {
            if (!item.mitra) return false
            const itemMitra = item.mitra.trim().toLowerCase()
            return (
              itemMitra === user.displayName.trim().toLowerCase() ||
              itemMitra === user.username.trim().toLowerCase() ||
              (user.identityCode &&
                itemMitra.includes(user.identityCode.trim().toLowerCase()))
            )
          })
          : items
      );
    } catch (error) {
      console.error("Gagal menyimpan ke database:", error);
      toast.error("Gagal menyimpan barang keluar ke database.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="@container/main flex h-full select-none flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex h-full flex-col gap-4 px-4 lg:px-6">
        
        {/* Smart Input Bar */}
        <Card className="shrink-0 border-primary/20 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
            <div className="flex flex-col items-end gap-4 sm:flex-row">
              <div className="w-full flex-1 space-y-1.5">
                <Label htmlFor="smart-input" className="text-sm font-semibold">Scan Barcode / SN</Label>
                <div className="relative">
                  <ScanLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    id="smart-input"
                    className="h-11 pl-9 font-mono text-base shadow-inner focus-visible:ring-primary/50"
                    placeholder="Contoh: ZTEG12345678"
                    value={kodeBarang}
                    onChange={(event) => updateKodeBarang(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleSubmit(kodeBarangRef.current);
                      }
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Sistem akan otomatis mendeteksi dari barcode scanner.</p>
              </div>

              {user?.role !== "mitra" ? (
                <div className="w-full space-y-1.5 sm:w-64">
                  <Label htmlFor="mitra-tujuan" className="text-sm font-semibold">Tujuan (Mitra)</Label>
                  <Select
                    value={selectedPartnerId}
                    onValueChange={(value) => {
                      setSelectedPartnerId(value);
                      focusKodeBarangInput();
                    }}
                  >
                    <SelectTrigger id="mitra-tujuan" className="h-11">
                      <SelectValue placeholder="Pilih mitra..." />
                    </SelectTrigger>
                    <SelectContent>
                      {dbPartners.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">Belum ada mitra aktif</div>
                      ) : (
                        dbPartners.map((partner) => (
                          <SelectItem key={partner.id} value={partner.id}>
                            {partner.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="w-full space-y-1.5 sm:w-64">
                  <Label htmlFor="keterangan-keluar" className="text-sm font-semibold">PA / Keterangan</Label>
                  <Input
                    id="keterangan-keluar"
                    className="h-11"
                    value={keterangan}
                    onChange={(event) => {
                      const nextKeterangan = event.target.value;
                      setKeterangan(nextKeterangan);
                      setBarangKeluar((current) =>
                        current.map((item) => ({
                          ...item,
                          keterangan: nextKeterangan,
                        }))
                      );
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        focusKodeBarangInput();
                      }
                    }}
                    placeholder="Contoh: PA-00123"
                  />
                </div>
              )}

              <Button className="h-11 w-full gap-2 sm:w-32" onClick={() => handleSubmit(kodeBarangRef.current)}>
                <PackageMinus className="size-4" />
                Tambah
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabel Layar Penuh */}
        <Card className="flex flex-1 flex-col overflow-hidden">
          <CardHeader className="shrink-0 flex-row items-center justify-between border-b pb-4">
            <CardTitle>Daftar Barang Keluar</CardTitle>
            <Badge variant="outline" className="w-fit">
              {barangKeluar.length} Item
            </Badge>
          </CardHeader>

          <CardContent className="relative flex-1 overflow-auto p-0">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/50 backdrop-blur-md">
                <TableRow>
                  <TableHead className="w-14">No</TableHead>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Merek</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Tipe/Model</TableHead>
                  <TableHead>Asal Lokasi</TableHead>
                  {user?.role !== "mitra" && <TableHead>Mitra</TableHead>}
                  {user?.role === "mitra" && <TableHead>PA / Keterangan</TableHead>}
                  <TableHead>{user?.role === "mitra" ? "Status" : "Status Validasi"}</TableHead>
                  <TableHead className="w-16 text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {barangKeluar.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-[300px] p-0">
                      <EmptyScanTableState />
                    </TableCell>
                  </TableRow>
                ) : (
                  barangKeluar.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="font-mono">{item.nomor}</TableCell>
                      <TableCell>{item.merek}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal px-2.5 py-0.5">
                          {item.kategori}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.tipe || "-"}</TableCell>
                      <TableCell>{item.lokasi}</TableCell>
                      {user?.role !== "mitra" && <TableCell>{item.mitra}</TableCell>}
                      {user?.role === "mitra" && <TableCell>{item.keterangan}</TableCell>}
                      <TableCell>
                        <Badge variant="secondary" className="gap-1.5 font-normal px-2.5 py-0.5">
                          <div
                            className={`size-1.5 rounded-full ${
                              user?.role === "mitra" ? "bg-sky-500" : "bg-emerald-500"
                            }`}
                          />
                          {user?.role === "mitra" ? "Diluar" : item.status}
                        </Badge>
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
          </CardContent>

          {/* Sticky Footer Metrics & Action */}
          <CardFooter className="shrink-0 flex-col items-start justify-between gap-4 border-t bg-muted/20 p-4 sm:flex-row sm:items-center">
            <div className="flex gap-6 text-sm">
              <div className="flex flex-col">
                <span className="text-muted-foreground">Total Scan</span>
                <span className="text-lg font-semibold">{barangKeluar.length} <span className="text-sm font-normal text-muted-foreground">Unit</span></span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Validasi</span>
                <span className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{validItems} <span className="text-sm font-normal text-emerald-600/70 dark:text-emerald-400/70">Valid</span></span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Kuota Tersisa</span>
                <span className="text-lg font-semibold">{totalKuotaTersedia} <span className="text-sm font-normal text-muted-foreground">Slot</span></span>
              </div>
            </div>
            
            <Button
              className="w-full gap-2 sm:w-auto"
              size="lg"
              onClick={handleValidateAll}
              disabled={barangKeluar.length === 0 || isSaving}
            >
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4" />}
              Simpan Barang Keluar
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
