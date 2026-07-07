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
  return normalizedStatus === "keluar";
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
            ? items.filter(
              (item) =>
                item.mitra?.trim().toLowerCase() ===
                user.displayName.trim().toLowerCase()
            )
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
    setKodeBarang((current) => {
      const nextValue = typeof value === "function" ? value(current) : value;
      kodeBarangRef.current = nextValue;
      return nextValue;
    });
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
          ? latestItems.filter(
            (item) => normalizeOwner(item.mitra) === normalizeOwner(user.displayName)
          )
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
          ? items.filter(
            (item) =>
              item.mitra?.trim().toLowerCase() ===
              user.displayName.trim().toLowerCase()
          )
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
      <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
        <Card className="@container/card relative">
          <div className="flex flex-row items-center">
            <div className="ml-4 rounded-lg bg-primary/10 p-3">
              <PackageMinus className="text-primary" />
            </div>
            <div className="flex w-full flex-col">
              <CardHeader className="flex flex-col">
                <CardDescription>Sesi Keluar</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {barangKeluar.length} <span className="text-sm font-normal text-muted-foreground">Unit</span>
                </CardTitle>
              </CardHeader>
            </div>
          </div>
        </Card>

        <Card className="@container/card relative">
          <div className="flex flex-row items-center">
            <div className="ml-4 rounded-lg bg-primary/10 p-3">
              <Archive className="text-primary" />
            </div>
            <div className="flex w-full flex-col">
              <CardHeader className="flex flex-col">
                <CardDescription>Data Master</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {dbItems.length} <span className="text-sm font-normal text-muted-foreground">Item</span>
                </CardTitle>
              </CardHeader>
            </div>
          </div>
        </Card>

        <Card className="@container/card relative">
          <div className="flex flex-row items-center">
            <div className="ml-4 rounded-lg bg-primary/10 p-3">
              <BadgeCheck className="text-primary" />
            </div>
            <div className="flex w-full flex-col">
              <CardHeader className="flex flex-col">
                <CardDescription>Validasi</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {validItems} <span className="text-sm font-normal text-muted-foreground">Valid</span>
                </CardTitle>
              </CardHeader>
            </div>
          </div>
        </Card>

        <Card className="@container/card relative">
          <div className="flex flex-row items-center">
            <div className="ml-4 rounded-lg bg-primary/10 p-3">
              <Boxes className="text-primary" />
            </div>
            <div className="flex w-full flex-col">
              <CardHeader className="flex flex-col">
                <CardDescription>Kuota Tersisa</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {totalKuotaTersedia} <span className="text-sm font-normal text-muted-foreground">Slot</span>
                </CardTitle>
              </CardHeader>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid h-full gap-4 px-4 lg:px-6 @5xl/main:grid-cols-[minmax(320px,380px)_1fr]">
        <Card className="@container/card flex flex-col @5xl/main:min-h-[calc(100svh-var(--header-height)-15rem)]">
          <Tabs
            value={inputMode}
            onValueChange={(value) => {
              setInputMode(value as "auto" | "manual");
              focusKodeBarangInput();
            }}
            className="flex flex-1 flex-col gap-4"
          >
            <CardHeader className="flex flex-col gap-4 pb-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="auto">Auto</TabsTrigger>
                <TabsTrigger value="manual">Manual</TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col gap-4">
              {user?.role !== "mitra" && (
                <div className="flex flex-col gap-3">
                  <Label htmlFor="mitra-tujuan">Tujuan</Label>
                  <Select
                    value={selectedPartnerId}
                    onValueChange={(value) => {
                      setSelectedPartnerId(value);
                      focusKodeBarangInput();
                    }}
                  >
                    <SelectTrigger id="mitra-tujuan" className="w-full">
                      <SelectValue placeholder="Pilih mitra tujuan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {dbPartners.map((partner) => (
                        <SelectItem key={partner.id} value={partner.id}>
                          {partner.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {dbPartners.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Belum ada mitra aktif. Tambahkan atau aktifkan mitra terlebih dahulu.
                    </p>
                  )}
                </div>
              )}

              {user?.role === "mitra" && (
                <div className="flex flex-col gap-3">
                  <Label htmlFor="keterangan-keluar">PA / Keterangan</Label>
                  <Input
                    id="keterangan-keluar"
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
                    placeholder="Contoh: PA-00123 atau keperluan barang"
                  />
                  <p className="text-xs text-muted-foreground">
                    Tekan Enter setelah mengisi agar scanner kembali aktif.
                  </p>
                </div>
              )}

              <TabsContent value="auto" className="mt-0 flex flex-1 flex-col">
                <Input
                  ref={inputRef}
                  id="kode-barang-auto"
                  value={kodeBarang}
                  onChange={(event) => updateKodeBarang(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Masukkan kode barang atau serial number"
                  className="hidden"
                />
                <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-muted/20 px-6 py-10 text-center">
                  <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <ScanLine className="size-8 animate-pulse" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-base font-semibold text-foreground">
                      Silakan scan menggunakan scanner
                    </p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Sistem akan menangkap kode secara otomatis dan menambahkannya ke daftar barang keluar.
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="manual" className="mt-0 flex flex-col gap-3">
                <Label htmlFor="kode-barang-manual">Kode / SN</Label>
                <Input
                  ref={inputRef}
                  id="kode-barang-manual"
                  value={kodeBarang}
                  onChange={(event) => updateKodeBarang(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Masukkan kode barang atau serial number"
                />
              </TabsContent>
            </CardContent>
          </Tabs>

          {inputMode === "manual" ? (
            <CardFooter className="mt-auto justify-end gap-2">
              <Button className="w-full gap-2 sm:w-auto" size="lg" onClick={() => handleSubmit()}>
                <PackageMinus className="size-4" />
                Simpan barang keluar
              </Button>
            </CardFooter>
          ) : null}
        </Card>

        <Card className="@container/card flex flex-col @5xl/main:min-h-[calc(100svh-var(--header-height)-15rem)]">
          <CardHeader className="flex flex-col gap-3 border-b pb-4 @lg/card:flex-row @lg/card:items-center @lg/card:justify-between">
            <div className="space-y-1">
              <CardTitle>Daftar Barang Keluar</CardTitle>
            </div>
            <Badge variant="outline" className="w-fit">
              {barangKeluar.length} Item
            </Badge>
          </CardHeader>

          <CardContent className="flex flex-1 flex-col gap-4">
            <div className="flex-1 overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted">
                  <TableRow>
                    <TableHead className="w-14">No</TableHead>
                    <TableHead>Serial Number</TableHead>
                    <TableHead>Merek</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Asal Lokasi</TableHead>
                    {user?.role !== "mitra" && (
                      <TableHead>Mitra</TableHead>
                    )}
                    {user?.role === "mitra" && (
                      <TableHead>PA / Keterangan</TableHead>
                    )}
                    <TableHead>
                      {user?.role === "mitra" ? "Status" : "Status Validasi"}
                    </TableHead>
                    <TableHead className="w-16 text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {barangKeluar.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="p-0"
                      >
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
                        <TableCell>{item.lokasi}</TableCell>
                        {user?.role !== "mitra" && (
                          <TableCell>{item.mitra}</TableCell>
                        )}
                        {user?.role === "mitra" && (
                          <TableCell>{item.keterangan}</TableCell>
                        )}
                        <TableCell>
                          <Badge variant="secondary" className="font-normal gap-1.5 px-2.5 py-0.5">
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${user?.role === "mitra" ? "bg-sky-500" : "bg-emerald-500"
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
            </div>
          </CardContent>

          <CardFooter className="justify-end gap-2">
            <Button
              className="w-full gap-2 sm:w-auto"
              size="lg"
              onClick={handleValidateAll}
              disabled={barangKeluar.length === 0 || isSaving}
            >
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
              Simpan
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
