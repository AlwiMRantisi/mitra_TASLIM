"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Plus, Edit, Trash2, Power, Layers, Archive, MoreVertical,
  Search, Box, AlignJustify, Loader2, QrCode
} from "lucide-react";
import QRCode from "qrcode";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";

/**
 * Helper: Mengembalikan Base URL untuk pemanggilan API.
 * 
 * @returns {string} String URL API Backend.
 */
const getBaseUrl = () => {
  const baseUrl = import.meta.env.URL || import.meta.env.VITE_URL ;
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

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import type { StorageLocation } from "@/types/inventory";
import type { SheetMode } from "@/types/ui";

/**
 * Komponen LokasiBarangPage
 * 
 * Halaman kompleks untuk manajemen struktur fisik gudang (Rak, Kardus, dan Level).
 * Dilengkapi dengan Kalkulator Grid otomatis dan fitur pembuatan (Generate) QR Code
 * menggunakan API Sistem Operasi dari Tauri.
 * 
 * @returns {JSX.Element} Antarmuka halaman lokasi barang.
 */
export default function LokasiBarangPage() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [brands, setBrands] = useState<string[]>(["Campuran"]);
  const [sheetMode, setSheetMode] = useState<SheetMode>("closed");
  const [activeItem, setActiveItem] = useState<{ parentId?: string; levelId?: string } | null>(null);
  const [activeTab, setActiveTab] = useState("rak");
  const [searchQuery, setSearchQuery] = useState("");

  // Form States
  const [locName, setLocName] = useState("");
  const [locCapacity, setLocCapacity] = useState("1");
  const [locBrand, setLocBrand] = useState("Campuran");
  const [locLevelsCount, setLocLevelsCount] = useState("3");
  const [levelName, setLevelName] = useState("");
  const [useCalculator, setUseCalculator] = useState(true);
  const [gridRows, setGridRows] = useState("1");
  const [gridCols, setGridCols] = useState("1");
  const [gridTiers, setGridTiers] = useState("1");
  const [deleteAlertData, setDeleteAlertData] = useState<{
    isOpen: boolean;
    type: "location" | "level" | null;
    id: string;
    name: string;
  }>({ isOpen: false, type: null, id: "", name: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadLocations = async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/locations`, {
        method: "GET",
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error("Gagal mengambil data lokasi");
      const data = await res.json();
      setLocations(
        data.filter((loc: StorageLocation) => loc.name !== "Keluar" && loc.name !== "Diluar")
      );
    } catch (error) {
      console.error("Failed to load locations:", error);
    }
  };

  const loadBrands = async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/brands`, {
        method: "GET",
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error("Gagal mengambil data merek");
      const data = await res.json();
      const brandsList = data.data || data.brands || data;
      const brandNames = ["Campuran", ...brandsList.map((b: any) => b.nama || b.name)];
      setBrands(brandNames);
    } catch (error) {
      console.error("Failed to load brands:", error);
      setBrands(["Campuran"]);
    }
  };

  useEffect(() => {
    loadLocations();
    loadBrands();
  }, []);

  /**
   * Menghitung statistik global gudang (Total Rak, Kapasitas, dsb.)
   * Di-memoize agar perhitungan (loop bersarang) tidak dijalankan ulang 
   * kecuali ada perubahan pada data `locations`.
   */
  const stats = useMemo(() => {
    let totalRak = 0;
    let totalKardus = 0;
    let maxCapacity = 0;
    let usedCapacity = 0;

    locations.forEach(loc => {
      if (loc.type === "Rak") {
        totalRak++;
        // Hitung akumulasi dari setiap anak (Level) rak
        loc.levels?.forEach(lvl => {
          maxCapacity += lvl.capacity;
          usedCapacity += lvl.usedCapacity;
        });
      } else {
        totalKardus++;
        maxCapacity += loc.capacity || 0;
        usedCapacity += loc.usedCapacity || 0;
      }
    });

    return { totalRak, totalKardus, maxCapacity, usedCapacity };
  }, [locations]);

  const filteredLocations = useMemo(() => {
    return locations.filter(loc => {
      const matchesTab = loc.type.toLowerCase() === activeTab;
      const matchesSearch = loc.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [locations, activeTab, searchQuery]);

  const resetForm = () => {
    setLocName("");
    setLocCapacity("1");
    setLocBrand("Campuran");
    setLocLevelsCount("1");
    setLevelName("");
    setUseCalculator(true);
    setGridRows("1");
    setGridCols("1");
    setGridTiers("1");
  };

  const handleOpenSheet = (mode: SheetMode, item?: { parentId?: string; levelId?: string }) => {
    setSheetMode(mode);
    setActiveItem(item || null);
    resetForm();

    if (item && item.parentId) {
      const loc = locations.find(l => l.id === item.parentId);
      if (loc) {
        if (mode === "edit-rak" || mode === "edit-kardus") {
          setLocName(loc.name);
          if (loc.type === "Kardus") {
            setLocCapacity(loc.capacity?.toString() || "");
            setLocBrand(loc.brandRule || "Campuran");
          }
        } else if (mode === "edit-level" && item.levelId) {
          const lvl = loc.levels?.find(l => l.id === item.levelId);
          if (lvl) {
            setLevelName(lvl.name);
            setLocCapacity(lvl.capacity.toString());
            setLocBrand(lvl.brandRule);
          }
        }
      }
    }
  };

  /**
   * Menyimpan data hierarki lokasi ke API Backend.
   * Mendukung berbagai mode form: Tambah Rak, Tambah Level, Edit Kardus, dll.
   */
  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (sheetMode === "add-rak") {
        // Otomatis men-generate N jumlah anak level berdasarkan input locLevelsCount
        const payload = {
          name: locName || "Rak Baru",
          type: "Rak",
          levels: Array.from({ length: parseInt(locLevelsCount) || 1 }).map((_, i) => ({
            name: `Level ${i + 1}`,
            capacity: 0,
            brandRule: "Campuran"
          }))
        };
        const res = await fetch(`${getBaseUrl()}/locations`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Gagal menambahkan rak");
        }
      } else if (sheetMode === "add-kardus") {
        const payload = {
          name: locName || "Kardus Baru",
          type: "Kardus",
          capacity: parseInt(locCapacity) || 0,
          brandRule: locBrand
        };
        const res = await fetch(`${getBaseUrl()}/locations`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Gagal menambahkan kardus");
        }
      } else if (sheetMode === "edit-rak" && activeItem?.parentId) {
        const res = await fetch(`${getBaseUrl()}/locations/${activeItem.parentId}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify({ name: locName }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Gagal memperbarui rak");
        }
      } else if (sheetMode === "edit-kardus" && activeItem?.parentId) {
        const res = await fetch(`${getBaseUrl()}/locations/${activeItem.parentId}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify({ name: locName, capacity: parseInt(locCapacity) || 0, brandRule: locBrand }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Gagal memperbarui kardus");
        }
      } else if (sheetMode === "add-level" && activeItem?.parentId) {
        const res = await fetch(`${getBaseUrl()}/locations/${activeItem.parentId}/levels`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            name: levelName || "Level Baru",
            capacity: parseInt(locCapacity) || 0,
            brandRule: locBrand
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Gagal menambahkan level");
        }
      } else if (sheetMode === "edit-level" && activeItem?.parentId && activeItem?.levelId) {
        const res = await fetch(`${getBaseUrl()}/locations/${activeItem.parentId}/levels/${activeItem.levelId}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify({
            name: levelName,
            capacity: parseInt(locCapacity) || 0,
            brandRule: locBrand
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Gagal memperbarui level");
        }
      }
      await loadLocations();

      if (sheetMode?.startsWith("add-")) {
        toast.success("Berhasil menambahkan data lokasi baru");
      } else {
        toast.success("Berhasil menyimpan perubahan data lokasi");
      }

      setSheetMode("closed");
    } catch (error: any) {
      console.error("Failed to save location data:", error);
      toast.error(error.message || "Gagal menyimpan data lokasi.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleLocation = async (id: string) => {
    if (isToggling) return;
    setIsToggling(true);
    try {
      const loc = locations.find(l => l.id === id);
      if (loc) {
        const res = await fetch(`${getBaseUrl()}/locations/${id}/toggle`, {
          method: "PATCH",
          headers: getHeaders(),
          body: JSON.stringify({ isActive: !loc.isActive }),
        });
        if (!res.ok) throw new Error("Gagal mengubah status lokasi");
        await loadLocations();
        toast.success(`Berhasil ${!loc.isActive ? 'mengaktifkan' : 'menonaktifkan'} lokasi`);
      }
    } catch (error) {
      console.error("Failed to toggle location:", error);
      toast.error("Gagal mengubah status lokasi");
    } finally {
      setIsToggling(false);
    }
  };

  const handleToggleLevel = async (rakId: string, levelId: string) => {
    if (isToggling) return;
    setIsToggling(true);
    try {
      const loc = locations.find(l => l.id === rakId);
      const lvl = loc?.levels?.find(l => l.id === levelId);
      if (lvl) {
        const res = await fetch(`${getBaseUrl()}/locations/${rakId}/levels/${levelId}/toggle`, {
          method: "PATCH",
          headers: getHeaders(),
          body: JSON.stringify({ isActive: !lvl.isActive }),
        });
        if (!res.ok) throw new Error("Gagal mengubah status level");
        await loadLocations();
        toast.success(`Berhasil ${!lvl.isActive ? 'mengaktifkan' : 'menonaktifkan'} level`);
      }
    } catch (error) {
      console.error("Failed to toggle level:", error);
      toast.error("Gagal mengubah status level");
    } finally {
      setIsToggling(false);
    }
  };

  const requestDeleteLocation = (id: string, name: string) => {
    setDeleteAlertData({ isOpen: true, type: "location", id, name });
  };

  const requestDeleteLevel = (levelId: string, name: string) => {
    setDeleteAlertData({ isOpen: true, type: "level", id: levelId, name });
  };

  const confirmDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isDeleting) return;
    const { type, id } = deleteAlertData;
    if (!type || !id) return;

    setIsDeleting(true);
    try {
      if (type === "location") {
        const res = await fetch(`${getBaseUrl()}/locations/${id}`, {
          method: "DELETE",
          headers: getHeaders(),
        });
        if (!res.ok) throw new Error("Gagal menghapus lokasi");
      } else if (type === "level") {
        const loc = locations.find(l => l.levels?.some(lvl => lvl.id === id));
        const locId = loc ? loc.id : "default";
        const res = await fetch(`${getBaseUrl()}/locations/${locId}/levels/${id}`, {
          method: "DELETE",
          headers: getHeaders(),
        });
        if (!res.ok) throw new Error("Gagal menghapus level");
      }
      await loadLocations();
      toast.success(`Berhasil menghapus ${type === "location" ? "lokasi" : "level"}`);
      setDeleteAlertData({ isOpen: false, type: null, id: "", name: "" });
    } catch (error) {
      console.error("Failed to delete:", error);
      toast.error(`Gagal menghapus data`);
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Meng-generate QR Code dan menyimpannya secara lokal.
   * Jika dijalankan via Tauri, akan memanggil fungsi OS (Rust) agar disimpan di path fisik.
   * Jika di Web Browser biasa, akan memicu unduhan HTML5 biasa.
   * 
   * @param {string | null | undefined} url - Link Google Spreadsheet tujuan.
   * @param {string} locationName - Label nama lokasi yang akan dicetak di bawah QR.
   */
  const handleDownloadQrCode = async (url: string | null | undefined, locationName: string) => {
    if (!url) {
      toast.error("Link spreadsheet belum tersedia untuk lokasi ini.");
      return;
    }

    try {
      // Generate QR Code data URL via library qrcode
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });

      // Siapkan objek gambar canvas untuk menggabungkan teks dan QR
      const img = new Image();
      img.src = qrDataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      // Konfigurasi tata letak Canvas
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      const width = 340;
      const height = 380;
      canvas.width = width;
      canvas.height = height;

      // Background Putih
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      // Render QR Code
      ctx.drawImage(img, 20, 20, 300, 300);

      // Render Teks Nama Lokasi
      ctx.fillStyle = "#000000";
      ctx.font = "bold 44px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(locationName, width / 2, 345);

      // Ekstrak hasil render menjadi base64 string
      const downloadUrl = canvas.toDataURL("image/png");
      const filename = `${locationName.replace(/[^a-zA-Z0-9]/g, "_")}.png`;

      if (isTauri()) {
        // Alur Desktop (Tauri): Minta Rust untuk menyimpan buffer secara langsung
        const base64Data = downloadUrl.replace(/^data:image\/png;base64,/, "");
        const binaryString = window.atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const savedPath = await invoke<string>("save_arxiva_file", {
          subfolder: "qr",
          filename,
          data: Array.from(bytes),
        });
        toast.success(`Berhasil menyimpan QR Code ke folder ${savedPath}`);
      } else {
        // Alur Web Browser Konvensional
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Berhasil menyimpan QR Code untuk ${locationName}`);
      }
    } catch (error) {
      console.error("Gagal menyimpan QR Code:", error);
      toast.error("Terjadi kesalahan saat membuat QR Code.");
    }
  };

  const handleGridChange = (r: string, c: string, t: string) => {
    setGridRows(r);
    setGridCols(c);
    setGridTiers(t);
    const rowsVal = parseInt(r) || 0;
    const colsVal = parseInt(c) || 0;
    const tiersVal = parseInt(t) || 0;
    const total = rowsVal * colsVal * tiersVal;
    setLocCapacity(total > 0 ? total.toString() : "");
  };

  const renderCapacityInput = () => {
    return (
      <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 transition-all duration-300">
        <Tabs
          value={useCalculator ? "grid" : "manual"}
          onValueChange={(val) => {
            const isGrid = val === "grid";
            setUseCalculator(isGrid);
            if (isGrid) {
              handleGridChange(gridRows, gridCols, gridTiers);
            }
          }}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 bg-neutral-950 border border-neutral-800 p-1 h-9">
            <TabsTrigger value="grid" className="text-xs font-semibold flex items-center justify-center">
              Kalkulator Grid
            </TabsTrigger>
            <TabsTrigger value="manual" className="text-xs font-semibold flex items-center justify-center">
              Manual
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {useCalculator ? (
          <div className="space-y-3.5">
            <div className="flex items-center gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="grid-rows" className="text-[11px] text-neutral-400">Baris</Label>
                <Input
                  id="grid-rows"
                  type="number"
                  min="1"
                  value={gridRows}
                  onChange={e => handleGridChange(e.target.value, gridCols, gridTiers)}
                  className="bg-neutral-950 border-neutral-800 h-9 text-center text-sm font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <span className="self-end pb-2 text-neutral-600 text-xs font-bold">×</span>
              <div className="flex-1 space-y-1">
                <Label htmlFor="grid-cols" className="text-[11px] text-neutral-400">Kolom</Label>
                <Input
                  id="grid-cols"
                  type="number"
                  min="1"
                  value={gridCols}
                  onChange={e => handleGridChange(gridRows, e.target.value, gridTiers)}
                  className="bg-neutral-950 border-neutral-800 h-9 text-center text-sm font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <span className="self-end pb-2 text-neutral-600 text-xs font-bold">×</span>
              <div className="flex-1 space-y-1">
                <Label htmlFor="grid-tiers" className="text-[11px] text-neutral-400">Tingkat</Label>
                <Input
                  id="grid-tiers"
                  type="number"
                  min="1"
                  value={gridTiers}
                  onChange={e => handleGridChange(gridRows, gridCols, e.target.value)}
                  className="bg-neutral-950 border-neutral-800 h-9 text-center text-sm font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
            <div className="text-[11px] text-neutral-500 font-medium bg-neutral-950/40 p-2 rounded-lg border border-neutral-800/40 text-center">
              Estimasi: <span className="text-neutral-300 font-bold">{gridRows || 0}</span> Baris × <span className="text-neutral-300 font-bold">{gridCols || 0}</span> Kolom × <span className="text-neutral-300 font-bold">{gridTiers || 0}</span> Tingkat = <span className="text-blue-400 font-extrabold">{locCapacity || 0}</span> Unit
            </div>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="loc-capacity" className="text-xs font-medium text-neutral-300 flex justify-between items-center">
            <span>Kapasitas Maksimal</span>
            {useCalculator && <span className="text-[10px] text-neutral-500 font-normal italic">(Bisa diedit secara manual)</span>}
          </Label>
          <div className="relative">
            <Input
              id="loc-capacity"
              type="number"
              min="0"
              value={locCapacity}
              onChange={e => setLocCapacity(e.target.value)}
              placeholder="Masukkan total kapasitas"
              className="bg-neutral-950 border-neutral-800 pr-12 text-sm font-semibold text-blue-400 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-neutral-500 select-none">
              Unit
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderForm = () => {
    if (sheetMode === "add-rak" || sheetMode === "edit-rak") {
      return (
        <>
          <div className="space-y-2">
            <Label>Nama Rak</Label>
            <Input value={locName} onChange={e => setLocName(e.target.value)} placeholder="Contoh: Rak A1" className="bg-neutral-900 border-neutral-800" />
          </div>
          {sheetMode === "add-rak" && (
            <div className="space-y-2">
              <Label>Jumlah Level Awal</Label>
              <Input type="number" min="1" value={locLevelsCount} onChange={e => setLocLevelsCount(e.target.value)} className="bg-neutral-900 border-neutral-800" />
            </div>
          )}
        </>
      );
    }

    if (sheetMode === "add-kardus" || sheetMode === "edit-kardus") {
      return (
        <>
          <div className="space-y-2">
            <Label>Nama Kardus</Label>
            <Input value={locName} onChange={e => setLocName(e.target.value)} placeholder="Contoh: Kardus K-01" className="bg-neutral-900 border-neutral-800" />
          </div>
          {renderCapacityInput()}
          <div className="space-y-2">
            <Label>Merek</Label>
            <Select value={locBrand} onValueChange={setLocBrand}>
              <SelectTrigger className="justify-start bg-neutral-900 border-neutral-800">
                <SelectValue placeholder="Pilih Aturan" />
              </SelectTrigger>
              <SelectContent>
                {brands.map(b => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      );
    }

    if (sheetMode === "add-level" || sheetMode === "edit-level") {
      return (
        <>
          <div className="space-y-2">
            <Label>Nama Level</Label>
            <Input value={levelName} onChange={e => setLevelName(e.target.value)} placeholder="Contoh: Level 1" className="bg-neutral-900 border-neutral-800" />
          </div>
          {renderCapacityInput()}
          <div className="space-y-2">
            <Label>Aturan Merek</Label>
            <Select value={locBrand} onValueChange={setLocBrand}>
              <SelectTrigger className="bg-neutral-900 border-neutral-800">
                <SelectValue placeholder="Pilih Aturan" />
              </SelectTrigger>
              <SelectContent>
                {brands.map(b => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      );
    }
    return null;
  };

  const sheetTitles = {
    "add-rak": "Tambah Rak Baru",
    "edit-rak": "Edit Rak",
    "add-kardus": "Tambah Kardus Baru",
    "edit-kardus": "Edit Kardus",
    "add-level": "Tambah Level Rak",
    "edit-level": "Edit Level Rak",
    "closed": ""
  };

  return (
    <div className="p-6 h-full flex flex-col gap-6 text-neutral-100 mx-auto w-full">
      <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs md:grid-cols-2 xl:grid-cols-4 dark:*:data-[slot=card]:bg-card">
        <Card className="@container/card relative">
          <div className="flex flex-row items-center">
            <div className="p-3 bg-primary/10 rounded-lg ml-4">
              <Layers className="text-primary w-5 h-5" />
            </div>
            <div className="flex flex-col w-full">
              <CardHeader className="flex flex-col">
                <CardDescription>Total Rak</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {stats.totalRak} <span className="text-sm font-normal text-muted-foreground">Unit</span>
                </CardTitle>
              </CardHeader>
            </div>
          </div>
        </Card>
        <Card className="@container/card relative">
          <div className="flex flex-row items-center">
            <div className="p-3 bg-primary/10 rounded-lg ml-4">
              <Archive className="text-primary w-5 h-5" />
            </div>
            <div className="flex flex-col w-full">
              <CardHeader className="flex flex-col">
                <CardDescription>Total Kardus</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {stats.totalKardus} <span className="text-sm font-normal text-muted-foreground">Unit</span>
                </CardTitle>
              </CardHeader>
            </div>
          </div>
        </Card>
        <Card className="@container/card relative">
          <div className="flex flex-row items-center">
            <div className="p-3 bg-primary/10 rounded-lg ml-4">
              <Box className="text-primary w-5 h-5" />
            </div>
            <div className="flex flex-col w-full">
              <CardHeader className="flex flex-col">
                <CardDescription>Kapasitas Terpakai</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {stats.usedCapacity} <span className="text-sm font-normal text-muted-foreground">Unit</span>
                </CardTitle>
              </CardHeader>
            </div>
          </div>
        </Card>
        <Card className="@container/card relative">
          <div className="flex flex-row items-center">
            <div className="p-3 bg-primary/10 rounded-lg ml-4">
              <AlignJustify className="text-primary w-5 h-5" />
            </div>
            <div className="flex flex-col w-full">
              <CardHeader className="flex flex-col">
                <CardDescription>Total Kapasitas</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {stats.maxCapacity} <span className="text-sm font-normal text-muted-foreground">Unit</span>
                </CardTitle>
              </CardHeader>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Tabs defaultValue="rak" value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-[300px]">
          <TabsList className="bg-neutral-900 border border-neutral-800 w-full grid grid-cols-2">
            <TabsTrigger value="rak">Rak</TabsTrigger>
            <TabsTrigger value="kardus">Kardus</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
            <Input
              type="search"
              placeholder="Cari lokasi..."
              className="w-full pl-9 bg-neutral-900 border-neutral-800 focus-visible:ring-1 focus-visible:ring-neutral-700"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="w-4 h-4" /> Tambah Lokasi
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-neutral-950 border-neutral-800 text-neutral-200">
              <DropdownMenuItem className="cursor-pointer focus:bg-neutral-800" onClick={() => handleOpenSheet("add-rak")}>
                <Layers className="w-4 h-4 mr-2" /> Tambah Rak
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer focus:bg-neutral-800" onClick={() => handleOpenSheet("add-kardus")}>
                <Archive className="w-4 h-4 mr-2" /> Tambah Kardus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 pb-10">
        {filteredLocations.map(loc => {
          if (loc.type === "Rak") {
            return (
              <Card key={loc.id} className={`border-neutral-800 bg-neutral-900/40 overflow-hidden flex flex-col relative group transition-all duration-300 hover:border-neutral-700 hover:bg-neutral-900/60 hover:shadow-xl hover:shadow-black/20 cursor-pointer ${!loc.isActive ? 'opacity-50 grayscale' : ''}`} onClick={(e) => { if ((e.target as HTMLElement).closest('button, [role="menuitem"]')) return; navigate(`/data-barang?search=${encodeURIComponent(loc.name)}`); }}>
                <CardHeader className="pb-4 border-b border-neutral-800/50 bg-neutral-900/20">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                          <Layers className="w-5 h-5 text-blue-400" />
                        </div>
                        <CardTitle className="text-xl font-semibold tracking-tight text-neutral-100">{loc.name}</CardTitle>
                      </div>
                      <CardDescription className="flex items-center gap-2 text-xs font-medium">
                        <span className="text-neutral-400">{loc.levels?.length || 0} Level</span>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-neutral-800 data-[state=open]:bg-neutral-800 text-neutral-400">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-neutral-950 border-neutral-800 text-neutral-200">
                          <DropdownMenuItem className="cursor-pointer focus:bg-neutral-800" onClick={() => handleOpenSheet("edit-rak", { parentId: loc.id })}>
                            <Edit className="w-4 h-4 mr-2" /> Edit Nama Rak
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer focus:bg-neutral-800" onClick={() => handleOpenSheet("add-level", { parentId: loc.id })}>
                            <Plus className="w-4 h-4 mr-2" /> Tambah Level
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-neutral-800" />
                          <DropdownMenuItem disabled={isToggling} className="cursor-pointer focus:bg-neutral-800" onClick={() => handleToggleLocation(loc.id)}>
                            <Power className="w-4 h-4 mr-2" /> {loc.isActive ? "Nonaktifkan Rak" : "Aktifkan Rak"}
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={isDeleting} className="text-red-400 focus:bg-red-950/50 focus:text-red-400 cursor-pointer" onClick={() => requestDeleteLocation(loc.id, loc.name)}>
                            <Trash2 className="w-4 h-4 mr-2" /> Hapus Rak
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-0 flex flex-col">
                  <div className="flex-1 overflow-y-auto max-h-[320px] p-4 space-y-3">
                    {loc.levels?.map(lvl => {
                      const isEffectiveActive = loc.isActive && lvl.isActive;
                      return (
                        <div key={lvl.id} onClick={(e) => { e.stopPropagation(); if ((e.target as HTMLElement).closest('button, [role="menuitem"]')) return; navigate(`/data-barang?search=${encodeURIComponent(`${loc.name} - ${lvl.name}`)}`); }} className={`p-3 rounded-xl border transition-colors ${isEffectiveActive ? 'border-neutral-800 bg-neutral-900/80 hover:border-neutral-700 cursor-pointer' : 'border-neutral-800/50 bg-neutral-900/30 opacity-50 grayscale'} flex flex-col gap-3 group/level`}>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-neutral-200">{lvl.name}</span>
                            </div>
                            <div className="flex gap-1 items-end">
                              <span className="px-2 py-0.5 rounded-md bg-neutral-800/80 text-neutral-300 truncate max-w-[120px] font-medium border border-neutral-700/50">{lvl.brandRule}</span>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full opacity-70 group-hover/level:opacity-100 transition-opacity hover:bg-neutral-800 text-neutral-400">
                                    <MoreVertical className="w-3.5 h-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-neutral-950 border-neutral-800 text-neutral-200">
                                  <DropdownMenuItem className="cursor-pointer focus:bg-neutral-800" onClick={() => handleOpenSheet("edit-level", { parentId: loc.id, levelId: lvl.id })}>
                                    <Edit className="w-4 h-4 mr-2" /> Edit Level
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="cursor-pointer focus:bg-neutral-800" onClick={() => handleDownloadQrCode(lvl.sheetUrl, `${loc.name} - ${lvl.name}`)}>
                                    <QrCode className="w-4 h-4 mr-2" /> Simpan QR Code
                                  </DropdownMenuItem>
                                  <DropdownMenuItem disabled={!loc.isActive || isToggling} className="cursor-pointer focus:bg-neutral-800" onClick={() => handleToggleLevel(loc.id, lvl.id)}>
                                    <Power className="w-4 h-4 mr-2" /> {lvl.isActive ? "Nonaktifkan Level" : "Aktifkan Level"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem disabled={isDeleting} className="text-red-400 focus:bg-red-950/50 focus:text-red-400 cursor-pointer" onClick={() => requestDeleteLevel(lvl.id, lvl.name)}>
                                    <Trash2 className="w-4 h-4 mr-2" /> Hapus Level
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex flex-col gap-1">
                              <span className="text-neutral-500 font-medium">Kapasitas</span>
                              <span className="text-neutral-300 font-semibold">{lvl.usedCapacity} <span className="text-neutral-600 font-normal">/ {lvl.capacity}</span></span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full bg-neutral-950 rounded-full overflow-hidden shadow-inner">
                            <div
                              className={`h-full transition-all duration-500 ${lvl.usedCapacity >= lvl.capacity ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : lvl.usedCapacity > lvl.capacity * 0.7 ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'}`}
                              style={{ width: `${lvl.capacity > 0 ? Math.min(100, (lvl.usedCapacity / lvl.capacity) * 100) : 0}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                    {(!loc.levels || loc.levels.length === 0) && (
                      <div className="text-center p-6 border-2 border-dashed border-neutral-800/80 rounded-xl text-neutral-500 text-sm flex flex-col items-center justify-center gap-2">
                        <Box className="w-8 h-8 text-neutral-700 mb-1" />
                        <p>Rak ini belum memiliki level.</p>
                        <Button variant="link" className="text-blue-400 h-auto p-0" onClick={() => handleOpenSheet("add-level", { parentId: loc.id })}>
                          Tambah level sekarang
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          } else {
            return (
              <Card key={loc.id} className={`border-neutral-800 bg-neutral-900/40 overflow-hidden flex flex-col relative group transition-all duration-300 hover:border-neutral-700 hover:bg-neutral-900/60 hover:shadow-md hover:shadow-black/20 cursor-pointer ${!loc.isActive ? 'opacity-50 grayscale' : ''}`} onClick={(e) => { if ((e.target as HTMLElement).closest('button, [role="menuitem"]')) return; navigate(`/data-barang?search=${encodeURIComponent(loc.name)}`); }}>
                <CardContent className="px-4 flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-500/10 rounded-lg shrink-0">
                        <Archive className="w-5 h-5 text-orange-400" />
                      </div>
                      <div className="space-y-0.5">
                        <CardTitle className="text-base font-semibold tracking-tight text-neutral-100">{loc.name}</CardTitle>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div>
                        <span className="px-2 py-0.5 rounded-md bg-neutral-800/80 text-neutral-300 truncate max-w-[120px] font-medium border border-neutral-700/50">{loc.brandRule}</span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-neutral-800 data-[state=open]:bg-neutral-800 text-neutral-400">
                            <MoreVertical className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-neutral-950 border-neutral-800 text-neutral-200">
                          <DropdownMenuItem className="cursor-pointer focus:bg-neutral-800" onClick={() => handleOpenSheet("edit-kardus", { parentId: loc.id })}>
                            <Edit className="w-4 h-4 mr-2" /> Edit Kardus
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer focus:bg-neutral-800" onClick={() => handleDownloadQrCode(loc.sheetUrl, loc.name)}>
                            <QrCode className="w-4 h-4 mr-2" /> Simpan QR Code
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-neutral-800" />
                          <DropdownMenuItem disabled={isToggling} className="cursor-pointer focus:bg-neutral-800" onClick={() => handleToggleLocation(loc.id)}>
                            <Power className="w-4 h-4 mr-2" /> {loc.isActive ? "Nonaktifkan Kardus" : "Aktifkan Kardus"}
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={isDeleting} className="text-red-400 focus:bg-red-950/50 focus:text-red-400 cursor-pointer" onClick={() => requestDeleteLocation(loc.id, loc.name)}>
                            <Trash2 className="w-4 h-4 mr-2" /> Hapus Kardus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="space-y-1.5 mt-auto">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-500 font-medium">Kapasitas</span>
                      <span className="font-semibold text-neutral-300">{loc.usedCapacity} <span className="text-neutral-600 font-normal">/ {loc.capacity}</span></span>
                    </div>
                    <div className="h-1.5 w-full bg-neutral-950 rounded-full overflow-hidden shadow-inner">
                      <div
                        className={`h-full transition-all duration-500 ${(loc.usedCapacity || 0) >= (loc.capacity || 0) ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : (loc.usedCapacity || 0) > (loc.capacity || 0) * 0.7 ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]'}`}
                        style={{ width: `${(loc.capacity || 0) > 0 ? Math.min(100, ((loc.usedCapacity || 0) / (loc.capacity || 0)) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          }
        })}
        {filteredLocations.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-neutral-900 rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-neutral-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-neutral-200">Lokasi Tidak Ditemukan</h3>
            <p className="text-neutral-500 max-w-md">Tidak ada lokasi penyimpanan yang sesuai dengan kriteria pencarian atau filter Anda.</p>
          </div>
        )}
      </div>

      <Sheet open={sheetMode !== "closed"} onOpenChange={(open) => !open && setSheetMode("closed")}>
        <SheetContent className="sm:max-w-md border-neutral-800 bg-neutral-950 p-0 flex flex-col text-neutral-200">
          <SheetHeader className="p-6 border-b border-neutral-800/60 bg-neutral-900/20">
            <SheetTitle className="text-xl text-neutral-100">{sheetTitles[sheetMode as keyof typeof sheetTitles]}</SheetTitle>
            <SheetDescription className="text-neutral-400">
              Isi formulir di bawah ini untuk mengelola detail lokasi penyimpanan Anda.
            </SheetDescription>
          </SheetHeader>
          <div className="p-6 flex-1 overflow-y-auto">
            <div className="grid gap-5">
              {renderForm()}
            </div>
          </div>
          <SheetFooter className="p-6 border-t border-neutral-800/60 bg-neutral-900/20 flex sm:justify-end gap-3 sm:gap-2">
            <Button variant="outline" onClick={() => setSheetMode("closed")} disabled={isSaving} className="hover:bg-neutral-800 text-neutral-300">Batal</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : "Simpan Perubahan"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteAlertData.isOpen} onOpenChange={(open) => !open && setDeleteAlertData({ ...deleteAlertData, isOpen: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle>
            <AlertDialogDescription className="text-neutral-400">
              Tindakan ini tidak dapat dibatalkan dan semua data terkait akan dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menghapus...</> : "Lanjutkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
