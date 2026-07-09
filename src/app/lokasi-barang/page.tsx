"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Plus, Edit, Trash2, Power, Layers, Archive, MoreVertical,
  Search, Box, Loader2, QrCode, Package, SlidersHorizontal
} from "lucide-react";
import QRCode from "qrcode";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";

import dummyLocations from "@/data/dummy-locations.json";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import type { StorageLocation } from "@/types/inventory";
import type { SheetMode } from "@/types/ui";

const getBaseUrl = () => {
  const baseUrl = import.meta.env.URL || import.meta.env.VITE_URL || "";
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
};

const getHeaders = () => {
  const token = localStorage.getItem("arxiva-auth-token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `${token}`;
  return headers;
};

/* ──────────────────────────────────────────────────────────
   AnimatedNumber — smooth count-up whenever `value` changes
   ────────────────────────────────────────────────────────── */
function AnimatedNumber({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let frame: number;
    let start: number | null = null;
    const from = display;
    const delta = value - from;
    if (delta === 0) return;
    const step = (timestamp: number) => {
      if (start === null) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(Math.round(from + delta * eased));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);
  return <>{display.toLocaleString("id-ID")}</>;
}

export default function LokasiBarangPage() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [brands, setBrands] = useState<string[]>(["Campuran"]);
  const [sheetMode, setSheetMode] = useState<SheetMode>("closed");
  const [activeItem, setActiveItem] = useState<{ parentId?: string; levelId?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"rak" | "kardus" | "pallet">("rak");
  const [sortBy, setSortBy] = useState<"util-desc" | "util-asc" | "name">("name");

  // Form States
  const [locName, setLocName] = useState("");
  const [locCapacity, setLocCapacity] = useState("1");
  const [locBrand, setLocBrand] = useState("Campuran");
  const [locLevelsCount, setLocLevelsCount] = useState("3");
  const [levelName, setLevelName] = useState("");
  const [deleteAlertData, setDeleteAlertData] = useState<{
    isOpen: boolean; type: "location" | "level" | null; id: string; name: string;
  }>({ isOpen: false, type: null, id: "", name: "" });

  const [isSaving, setIsSaving] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadLocations = async () => {
  setLocations((dummyLocations as StorageLocation[]).filter(
    loc => loc.name !== "Keluar" && loc.name !== "Diluar"
  ));
};


  const loadBrands = async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/brands`, { method: "GET", headers: getHeaders() });
      if (!res.ok) throw new Error("Gagal mengambil data merek");
      const data = await res.json();
      const brandsList = data.data || data.brands || data || [];
      setBrands(["Campuran", ...brandsList.map((b: any) => b.nama || b.name)]);
    } catch (error) {
      setBrands(["Campuran", "Huawei", "ZTE", "Nokia", "FiberHome"]);
    }
  };

  useEffect(() => {
    loadLocations();
    loadBrands();
  }, []);

  const stats = useMemo(() => {
    let totalRak = 0, totalKardus = 0, totalPallet = 0, maxCapacity = 0, usedCapacity = 0;
    locations.forEach(loc => {
      if (loc.type === "Rak") {
        totalRak++;
        loc.levels?.forEach(lvl => { maxCapacity += lvl.capacity; usedCapacity += lvl.usedCapacity; });
      } else if (loc.type === "Pallet") {
        totalPallet++; maxCapacity += loc.capacity || 0; usedCapacity += loc.usedCapacity || 0;
      } else {
        totalKardus++; maxCapacity += loc.capacity || 0; usedCapacity += loc.usedCapacity || 0;
      }
    });
    const utilizationPct = maxCapacity > 0 ? Math.round((usedCapacity / maxCapacity) * 100) : 0;
    return { totalRak, totalKardus, totalPallet, maxCapacity, usedCapacity, utilizationPct };
  }, [locations]);

  const filteredAndSortedLocations = useMemo(() => {
    let result = locations.filter(loc => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = loc.name.toLowerCase().includes(q) ||
        (loc.brandRule && loc.brandRule.toLowerCase().includes(q)) ||
        (loc.levels && loc.levels.some(l => l.name.toLowerCase().includes(q) || l.brandRule.toLowerCase().includes(q)));
        
      const matchesType =  loc.type.toLowerCase() === filterType;
      
      return matchesSearch && matchesType;
    });

    if (sortBy === "name") {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "util-desc" || sortBy === "util-asc") {
      const getUsagePct = (loc: StorageLocation) => {
        if (loc.type === "Rak") {
          let cap = 0, used = 0;
          loc.levels?.forEach(lvl => { cap += lvl.capacity; used += lvl.usedCapacity; });
          return cap > 0 ? (used / cap) : 0;
        } else {
          const cap = loc.capacity || 0;
          return cap > 0 ? ((loc.usedCapacity || 0) / cap) : 0;
        }
      };
      result = [...result].sort((a, b) => {
        const pctA = getUsagePct(a);
        const pctB = getUsagePct(b);
        return sortBy === "util-desc" ? pctB - pctA : pctA - pctB;
      });
    }
    return result;
  }, [locations, searchQuery, filterType, sortBy]);

  const handleOpenSheet = (mode: SheetMode, item?: { parentId?: string; levelId?: string }) => {
    setSheetMode(mode);
    setActiveItem(item || null);
    
    // Reset form states
    setLocName("");
    setLocCapacity("1");
    setLocBrand("Campuran");
    setLocLevelsCount("3");
    setLevelName("");

    if (item && item.parentId) {
      const loc = locations.find(l => l.id === item.parentId);
      if (loc) {
        if (mode === "edit-rak" || mode === "edit-kardus" || mode === "edit-pallet") {
          setLocName(loc.name);
          if (loc.type === "Kardus" || loc.type === "Pallet") {
            setLocCapacity(loc.capacity?.toString() || "0");
            setLocBrand(loc.brandRule || "Campuran");
          }
        } else if (mode === "edit-level" && item.levelId) {
          const lvl = loc.levels?.find(l => l.id === item.levelId);
          if (lvl) {
            setLevelName(lvl.name);
            setLocCapacity(lvl.capacity.toString());
            setLocBrand(lvl.brandRule || "Campuran");
          }
        }
      }
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (sheetMode === "add-rak") {
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
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.message || "Gagal menambahkan rak");
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
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.message || "Gagal menambahkan kardus");
        }
      } else if (sheetMode === "add-pallet") {
        const payload = {
          name: locName || "Pallet Baru",
          type: "Pallet",
          capacity: parseInt(locCapacity) || 0,
          brandRule: locBrand
        };
        const res = await fetch(`${getBaseUrl()}/locations`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.message || "Gagal menambahkan pallet");
        }
      } else if (sheetMode === "edit-rak" && activeItem?.parentId) {
        const res = await fetch(`${getBaseUrl()}/locations/${activeItem.parentId}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify({ name: locName })
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.message || "Gagal memperbarui rak");
        }
      } else if (sheetMode === "edit-kardus" && activeItem?.parentId) {
        const res = await fetch(`${getBaseUrl()}/locations/${activeItem.parentId}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify({ name: locName, capacity: parseInt(locCapacity) || 0, brandRule: locBrand })
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.message || "Gagal memperbarui kardus");
        }
      } else if (sheetMode === "edit-pallet" && activeItem?.parentId) {
        const res = await fetch(`${getBaseUrl()}/locations/${activeItem.parentId}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify({ name: locName, capacity: parseInt(locCapacity) || 0, brandRule: locBrand })
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.message || "Gagal memperbarui pallet");
        }
      } else if (sheetMode === "add-level" && activeItem?.parentId) {
        const res = await fetch(`${getBaseUrl()}/locations`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            name: levelName || "Level Baru",
            type: "Kardus",
            parentId: activeItem.parentId,
            capacity: parseInt(locCapacity) || 0,
            brandRule: locBrand
          })
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.message || "Gagal menambahkan level");
        }
      } else if (sheetMode === "edit-level" && activeItem?.parentId && activeItem?.levelId) {
        const res = await fetch(`${getBaseUrl()}/locations/${activeItem.levelId}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify({ name: levelName, capacity: parseInt(locCapacity) || 0, brandRule: locBrand })
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.message || "Gagal memperbarui level");
        }
      }
      await loadLocations();
      toast.success(sheetMode?.startsWith("add-") ? "Berhasil menambahkan lokasi baru" : "Berhasil menyimpan perubahan");
      setSheetMode("closed");
    } catch (error: any) {
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
          body: JSON.stringify({ isActive: !loc.isActive })
        });
        if (!res.ok) throw new Error("Gagal mengubah status lokasi");
        await loadLocations();
        toast.success(`Berhasil ${!loc.isActive ? 'mengaktifkan' : 'menonaktifkan'} lokasi`);
      }
    } catch {
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
        const res = await fetch(`${getBaseUrl()}/locations/${levelId}/toggle`, {
          method: "PATCH",
          headers: getHeaders(),
          body: JSON.stringify({ isActive: !lvl.isActive })
        });
        if (!res.ok) throw new Error("Gagal mengubah status level");
        await loadLocations();
        toast.success(`Berhasil ${!lvl.isActive ? 'mengaktifkan' : 'menonaktifkan'} level`);
      }
    } catch {
      toast.error("Gagal mengubah status level");
    } finally {
      setIsToggling(false);
    }
  };

  const requestDeleteLocation = (id: string, name: string) => setDeleteAlertData({ isOpen: true, type: "location", id, name });
  const requestDeleteLevel = (levelId: string, name: string) => setDeleteAlertData({ isOpen: true, type: "level", id: levelId, name });

  const confirmDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isDeleting) return;
    const { type, id } = deleteAlertData;
    if (!type || !id) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${getBaseUrl()}/locations/${id}`, { method: "DELETE", headers: getHeaders() });
      if (!res.ok) throw new Error("Gagal menghapus");
      await loadLocations();
      toast.success(`Berhasil menghapus ${type === "location" ? "lokasi" : "level"}`);
      setDeleteAlertData({ isOpen: false, type: null, id: "", name: "" });
    } catch {
      toast.error("Gagal menghapus data");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadQrCode = async (url: string | null | undefined, locationName: string) => {
    if (!url) {
      toast.error("Link spreadsheet belum tersedia untuk lokasi ini.");
      return;
    }
    try {
      const qrDataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: "#000000", light: "#ffffff" } });
      const img = new Image();
      img.src = qrDataUrl;
      await new Promise((resolve) => { img.onload = resolve; });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      canvas.width = 340;
      canvas.height = 380;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 340, 380);
      ctx.drawImage(img, 20, 20, 300, 300);
      ctx.fillStyle = "#000000";
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(locationName, 170, 345);
      const downloadUrl = canvas.toDataURL("image/png");
      const filename = `${locationName.replace(/[^a-zA-Z0-9]/g, "_")}.png`;

      if (isTauri()) {
        const base64Data = downloadUrl.replace(/^data:image\/png;base64,/, "");
        const binaryString = window.atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        const savedPath = await invoke<string>("save_arxiva_file", { subfolder: "qr", filename, data: Array.from(bytes) });
        toast.success(`Berhasil menyimpan QR Code ke folder ${savedPath}`);
      } else {
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Berhasil menyimpan QR Code untuk ${locationName}`);
      }
    } catch {
      toast.error("Terjadi kesalahan saat membuat QR Code.");
    }
  };

  const renderCapacityInput = () => (
    <div className="space-y-2 rounded-xl border border-neutral-850 bg-neutral-900/20 p-4">
      <div className="space-y-1.5">
        <Label htmlFor="loc-capacity" className="text-xs font-semibold text-neutral-300 flex justify-between items-center">
          <span>Kapasitas Maksimal</span>
          <span className="text-[10px] text-neutral-500 font-normal italic">(Dapat diubah secara manual)</span>
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
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-neutral-500 select-none">Unit</span>
        </div>
      </div>
    </div>
  );

  const renderForm = () => {
    if (sheetMode === "add-rak" || sheetMode === "edit-rak") return (
      <>
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-neutral-300">Nama Rak</Label>
          <Input value={locName} onChange={e => setLocName(e.target.value)} placeholder="Contoh: Rak A1" className="bg-neutral-900 border-neutral-800 focus-visible:ring-1 focus-visible:ring-neutral-700" />
        </div>
        {sheetMode === "add-rak" && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-neutral-300">Jumlah Level Awal</Label>
            <Input type="number" min="1" value={locLevelsCount} onChange={e => setLocLevelsCount(e.target.value)} placeholder="Masukkan Total Level" className="bg-neutral-900 border-neutral-800 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
        )}
      </>
    );
    if (sheetMode === "add-kardus" || sheetMode === "edit-kardus") return (
      <>
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-neutral-300">Nama Kardus</Label>
          <Input value={locName} onChange={e => setLocName(e.target.value)} placeholder="Contoh: Kardus K-01" className="bg-neutral-900 border-neutral-800 focus-visible:ring-1 focus-visible:ring-neutral-700" />
        </div>
        {renderCapacityInput()}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-neutral-300">Aturan Merek</Label>
          <Select value={locBrand} onValueChange={setLocBrand}>
            <SelectTrigger className="justify-start bg-neutral-900 border-neutral-800 focus:ring-1 focus:ring-neutral-700"><SelectValue placeholder="Pilih Aturan" /></SelectTrigger>
            <SelectContent className="bg-neutral-950 border-neutral-800 text-neutral-200">
              {brands.map(b => <SelectItem key={b} value={b} className="focus:bg-neutral-800">{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </>
    );
    if (sheetMode === "add-pallet" || sheetMode === "edit-pallet") return (
      <>
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-neutral-300">Nama Pallet</Label>
          <Input value={locName} onChange={e => setLocName(e.target.value)} placeholder="Contoh: Pallet P-01" className="bg-neutral-900 border-neutral-800 focus-visible:ring-1 focus-visible:ring-neutral-700" />
        </div>
        {renderCapacityInput()}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-neutral-300">Aturan Merek</Label>
          <Select value={locBrand} onValueChange={setLocBrand}>
            <SelectTrigger className="justify-start bg-neutral-900 border-neutral-800 focus:ring-1 focus:ring-neutral-700"><SelectValue placeholder="Pilih Aturan" /></SelectTrigger>
            <SelectContent className="bg-neutral-950 border-neutral-800 text-neutral-200">
              {brands.map(b => <SelectItem key={b} value={b} className="focus:bg-neutral-800">{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </>
    );
    if (sheetMode === "add-level" || sheetMode === "edit-level") return (
      <>
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-neutral-300">Nama Level</Label>
          <Input value={levelName} onChange={e => setLevelName(e.target.value)} placeholder="Contoh: Level 1" className="bg-neutral-900 border-neutral-800 focus-visible:ring-1 focus-visible:ring-neutral-700" />
        </div>
        {renderCapacityInput()}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-neutral-300">Aturan Merek</Label>
          <Select value={locBrand} onValueChange={setLocBrand}>
            <SelectTrigger className="bg-neutral-900 border-neutral-800 focus:ring-1 focus:ring-neutral-700"><SelectValue placeholder="Pilih Aturan" /></SelectTrigger>
            <SelectContent className="bg-neutral-950 border-neutral-800 text-neutral-200">
              {brands.map(b => <SelectItem key={b} value={b} className="focus:bg-neutral-800">{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </>
    );
    return null;
  };

  const sheetTitles: Record<string, string> = {
    "add-rak": "Tambah Rak Baru", "edit-rak": "Edit Rak",
    "add-kardus": "Tambah Kardus Baru", "edit-kardus": "Edit Kardus",
    "add-pallet": "Tambah Pallet Baru", "edit-pallet": "Edit Pallet",
    "add-level": "Tambah Level Rak", "edit-level": "Edit Level Rak", "closed": "",
  };

  // Helper for progress colors
  const getProgressStyles = (used: number, cap: number, baseColor: string) => {
    if (cap <= 0) return { barClass: "bg-neutral-800", textClass: "text-neutral-500", label: "0%", pct: 0 };
    const pct = Math.min(100, Math.round((used / cap) * 100));
    let barClass = baseColor;
    let textClass = "text-neutral-300";
    if (pct >= 100) {
      barClass = "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]";
      textClass = "text-red-400 font-bold";
    } else if (pct > 70) {
      barClass = "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]";
      textClass = "text-amber-400 font-semibold";
    }
    return { barClass, textClass, pct, label: `${pct}%` };
  };

  return (
    <div className="p-6 h-full flex flex-col gap-6 text-neutral-100 mx-auto w-full max-w-7xl">
      
      {/* ── 1. HEADER SECTION ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-neutral-800/60 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-neutral-50 via-neutral-100 to-neutral-400 bg-clip-text text-transparent">
            Lokasi Penyimpanan
          </h1>
          <p className="text-xs text-neutral-400 mt-1.5">
            Kelola tata letak fisik, aturan merek, dan pantau ketersediaan kapasitas rak, kardus, atau pallet.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-md shadow-blue-950/20 active:scale-95 transition-all cursor-pointer">
              <Plus className="w-4 h-4 mr-1.5" /> Tambah Lokasi
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-neutral-950 border-neutral-800 text-neutral-200">
            <DropdownMenuItem className="cursor-pointer focus:bg-neutral-800 text-xs" onClick={() => handleOpenSheet("add-rak")}>
              <Layers className="w-4 h-4 mr-2 text-blue-400" /> Tambah Rak
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer focus:bg-neutral-800 text-xs" onClick={() => handleOpenSheet("add-kardus")}>
              <Archive className="w-4 h-4 mr-2 text-amber-400" /> Tambah Kardus
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer focus:bg-neutral-800 text-xs" onClick={() => handleOpenSheet("add-pallet")}>
              <Package className="w-4 h-4 mr-2 text-emerald-400" /> Tambah Pallet
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── 2. WAREHOUSE STATISTICS BANNER ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Warehouse occupancy tracker */}
        <Card className="lg:col-span-2 bg-neutral-900/20 border-neutral-800 backdrop-blur-xs p-6 flex flex-col md:flex-row gap-6 justify-between relative overflow-hidden">
          <div className="flex-1 flex flex-col justify-between z-10">
            <div>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <CardTitle className="text-sm font-bold text-neutral-300 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                    Okupansi Kapasitas Gudang
                  </CardTitle>
                  <CardDescription className="text-xs text-neutral-500 mt-1">
                    Status pemakaian kapasitas total di semua lokasi (Rak, Kardus, Pallet)
                  </CardDescription>
                </div>
              </div>

              {/* Segmented stacked bar chart */}
              {(() => {
                const rakUsed = (() => { let u = 0, c = 0; locations.filter(l => l.type === "Rak").forEach(l => l.levels?.forEach(lv => { u += lv.usedCapacity; c += lv.capacity; })); return { u, c }; })();
                const kardusUsed = (() => { let u = 0, c = 0; locations.filter(l => l.type === "Kardus").forEach(l => { u += l.usedCapacity || 0; c += l.capacity || 0; }); return { u, c }; })();
                const palletUsed = (() => { let u = 0, c = 0; locations.filter(l => l.type === "Pallet").forEach(l => { u += l.usedCapacity || 0; c += l.capacity || 0; }); return { u, c }; })();
                const total = stats.maxCapacity || 1;
                const rakPct   = Math.round((rakUsed.u   / total) * 100);
                const kardusPct = Math.round((kardusUsed.u / total) * 100);
                const palletPct = Math.round((palletUsed.u / total) * 100);
                const freePct   = Math.max(0, 100 - rakPct - kardusPct - palletPct);
                const segments = [
                  { label: "Rak",    pct: rakPct,    color: "bg-blue-500",    glow: "rgba(59,130,246,0.45)" },
                  { label: "Kardus", pct: kardusPct, color: "bg-amber-400",   glow: "rgba(251,191,36,0.45)" },
                  { label: "Pallet", pct: palletPct, color: "bg-emerald-500", glow: "rgba(16,185,129,0.45)" },
                  { label: "Kosong", pct: freePct,   color: "bg-neutral-800", glow: "" },
                ];
                return (
                  <div className="mt-4 space-y-3">
                    {/* Stacked bar */}
                    <div className="w-full h-5 rounded-full overflow-hidden flex bg-neutral-950 shadow-inner">
                      {segments.map((s) =>
                        s.pct > 0 ? (
                          <div
                            key={s.label}
                            className={`${s.color} h-full transition-all duration-1000 ease-out first:rounded-l-full last:rounded-r-full`}
                            style={{
                              width: `${s.pct}%`,
                              boxShadow: s.glow ? `0 0 8px ${s.glow}` : undefined,
                            }}
                          />
                        ) : null
                      )}
                    </div>

                    {/* Legend row */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {segments.map((s) => (
                        <div key={s.label} className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${s.color} shrink-0`} />
                          <span className="text-[11px] text-neutral-500">{s.label}</span>
                          <span className="text-[11px] font-semibold text-neutral-300">{s.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
            
            <div className="flex flex-wrap justify-between items-center gap-4 border-t border-neutral-800/40 pt-4 mt-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-xs text-neutral-500">Terpakai:</span>
                <span className="text-xs font-semibold text-neutral-300"><AnimatedNumber value={stats.usedCapacity} /> Unit</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-neutral-500">Tersedia:</span>
                <span className="text-xs font-semibold text-neutral-300"><AnimatedNumber value={Math.max(0, stats.maxCapacity - stats.usedCapacity)} /> Unit</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-neutral-600" />
                <span className="text-xs text-neutral-500">Total Kapasitas:</span>
                <span className="text-xs font-semibold text-neutral-300"><AnimatedNumber value={stats.maxCapacity} /> Unit</span>
              </div>
            </div>
          </div>

          {/* Donut chart illustration */}
          {(() => {
            const pct = Math.min(100, stats.utilizationPct);
            const r = 44;
            const circ = 2 * Math.PI * r;
            const dash = (pct / 100) * circ;
            const isHigh = pct >= 100;
            const isMid  = pct > 70;
            const strokeColor = isHigh ? "#ef4444" : isMid ? "#f59e0b" : "#6366f1";
            const glowColor   = isHigh ? "rgba(239,68,68,0.45)" : isMid ? "rgba(245,158,11,0.4)" : "rgba(99,102,241,0.45)";
            const textColor   = isHigh ? "#f87171" : isMid ? "#fbbf24" : "#818cf8";
            return (
              <div className="hidden md:flex items-center justify-center shrink-0 z-10 self-center">
                <svg width="120" height="120" viewBox="0 0 120 120" className="drop-shadow-lg" style={{ filter: `drop-shadow(0 0 10px ${glowColor})` }}>
                  {/* Track */}
                  <circle cx="60" cy="60" r={r} fill="none" stroke="#1f2937" strokeWidth="12" />
                  {/* Progress arc */}
                  <circle
                    cx="60" cy="60" r={r}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${circ}`}
                    strokeDashoffset={circ / 4}
                    style={{ transition: "stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1), stroke 0.5s ease" }}
                  />
                  {/* Center text */}
                  <text x="60" y="57" textAnchor="middle" fontSize="16" fontWeight="800" fill={textColor} fontFamily="system-ui, sans-serif">
                    {pct}%
                  </text>
                  <text x="60" y="72" textAnchor="middle" fontSize="7.5" fill="#6b7280" fontFamily="system-ui, sans-serif" letterSpacing="0.5">
                    TERPAKAI
                  </text>
                </svg>
              </div>
            );
          })()}
        </Card>

        {/* Card 2: Physical type summary counts */}
        <Card className="bg-neutral-900/20 border-neutral-800 backdrop-blur-xs p-6 flex flex-col justify-between gap-4">
          <div>
            <CardTitle className="text-sm font-semibold text-neutral-300">Tipe Penyimpanan</CardTitle>
            <CardDescription className="text-xs text-neutral-500 mt-1">
              Jumlah lokasi aktif dan terdaftar berdasarkan kategori
            </CardDescription>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-neutral-950/40 border border-neutral-850 rounded-xl p-3 text-center transition-all duration-350 hover:border-neutral-800">
              <div className="p-1.5 bg-blue-500/10 rounded-lg w-fit mx-auto mb-2"><Layers className="w-4 h-4 text-blue-400" /></div>
              <div className="text-[10px] text-neutral-500 font-medium">Rak</div>
              <div className="text-lg font-bold text-neutral-100 mt-0.5"><AnimatedNumber value={stats.totalRak} /></div>
            </div>
            <div className="bg-neutral-950/40 border border-neutral-850 rounded-xl p-3 text-center transition-all duration-350 hover:border-neutral-800">
              <div className="p-1.5 bg-amber-500/10 rounded-lg w-fit mx-auto mb-2"><Archive className="w-4 h-4 text-amber-400" /></div>
              <div className="text-[10px] text-neutral-500 font-medium">Kardus</div>
              <div className="text-lg font-bold text-neutral-100 mt-0.5"><AnimatedNumber value={stats.totalKardus} /></div>
            </div>
            <div className="bg-neutral-950/40 border border-neutral-850 rounded-xl p-3 text-center transition-all duration-350 hover:border-neutral-800">
              <div className="p-1.5 bg-emerald-500/10 rounded-lg w-fit mx-auto mb-2"><Package className="w-4 h-4 text-emerald-400" /></div>
              <div className="text-[10px] text-neutral-500 font-medium">Pallet</div>
              <div className="text-lg font-bold text-neutral-100 mt-0.5"><AnimatedNumber value={stats.totalPallet} /></div>
            </div>
          </div>
        </Card>
      </div>

      {/* ── 3. INTEGRATED SEARCH & FILTERS ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-neutral-900/10 border border-neutral-800/80 rounded-2xl p-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <Input
            type="search"
            placeholder="Cari nama lokasi atau aturan merek..."
            className="w-full pl-9 bg-neutral-955 border-neutral-800 focus-visible:ring-1 focus-visible:ring-neutral-700"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Category badges */}
          <div className="flex items-center gap-1.5 bg-neutral-955/60 p-1 rounded-xl border border-neutral-800">
            {([
              { key: "rak", label: "Rak" },
              { key: "kardus", label: "Kardus" },
              { key: "pallet", label: "Pallet" }
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilterType(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
                  filterType === key
                    ? "bg-neutral-800 text-neutral-100 border border-neutral-750 shadow-inner"
                    : "text-neutral-500 hover:text-neutral-350 border border-transparent"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <span className="w-px h-6 bg-neutral-800 hidden md:block" />

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-500" />
            <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
              <SelectTrigger className="w-40 bg-neutral-955 border-neutral-800 text-xs font-semibold text-neutral-300 focus:ring-1 focus:ring-neutral-700 cursor-pointer">
                <SelectValue placeholder="Urutkan..." />
              </SelectTrigger>
              <SelectContent className="bg-neutral-955 border-neutral-800 text-neutral-200 text-xs">
                <SelectItem value="name" className="focus:bg-neutral-800 text-xs font-medium cursor-pointer">Nama (A-Z)</SelectItem>
                <SelectItem value="util-desc" className="focus:bg-neutral-800 text-xs font-medium cursor-pointer">Terisi Tertinggi</SelectItem>
                <SelectItem value="util-asc" className="focus:bg-neutral-800 text-xs font-medium cursor-pointer">Terisi Terendah</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── 4. LOCATION CARDS GRID ── */}
      <div  className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 pb-16">
        {filteredAndSortedLocations.map(loc => {
          const isLocActive = loc.isActive;
          
          if (loc.type === "Rak") {
            return (
              <Card
                key={loc.id}
                className={`border-neutral-800 bg-neutral-900/10 flex flex-col relative group transition-all duration-300 hover:border-neutral-700/80 hover:bg-neutral-900/20 hover:shadow-lg hover:shadow-black/20 ${!isLocActive ? 'opacity-60 saturate-50' : ''}`}
              >
                {/* Header */}
                <CardHeader className="pb-3 border-b border-neutral-800/40 bg-neutral-900/5 px-4 pt-4 flex flex-row items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-blue-500/10 rounded-lg"><Layers className="w-4 h-4 text-blue-400" /></div>
                    <div>
                      <CardTitle className="text-sm font-bold text-neutral-100 flex items-center gap-1.5">
                        {loc.name}
                        {!isLocActive && <span className="text-[10px] bg-neutral-850 text-neutral-500 border border-neutral-800 px-1.5 py-0.2 rounded-md font-medium">Nonaktif</span>}
                      </CardTitle>
                      <CardDescription className="text-[10px] text-neutral-500 mt-0.5">{loc.levels?.length || 0} Level Penyimpanan</CardDescription>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-neutral-800 text-neutral-400 cursor-pointer"><MoreVertical className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-neutral-955 border-neutral-800 text-neutral-200">
                      <DropdownMenuItem className="cursor-pointer focus:bg-neutral-800 text-xs" onClick={() => handleOpenSheet("edit-rak", { parentId: loc.id })}><Edit className="w-3.5 h-3.5 mr-2" /> Edit Nama Rak</DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer focus:bg-neutral-800 text-xs" onClick={() => handleOpenSheet("add-level", { parentId: loc.id })}><Plus className="w-3.5 h-3.5 mr-2" /> Tambah Level</DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-neutral-800" />
                      <DropdownMenuItem disabled={isToggling} className="cursor-pointer focus:bg-neutral-800 text-xs" onClick={() => handleToggleLocation(loc.id)}><Power className="w-3.5 h-3.5 mr-2" /> {isLocActive ? "Nonaktifkan Rak" : "Aktifkan Rak"}</DropdownMenuItem>
                      <DropdownMenuItem disabled={isDeleting} className="text-red-400 focus:bg-red-950/50 focus:text-red-400 cursor-pointer text-xs" onClick={() => requestDeleteLocation(loc.id, loc.name)}><Trash2 className="w-3.5 h-3.5 mr-2" /> Hapus Rak</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>

                {/* Content: Compact List of Levels */}
                <CardContent className="p-3 flex-1 flex flex-col gap-2.5">
                  {loc.levels?.map(lvl => {
                    const isLvlEffectiveActive = isLocActive && lvl.isActive;
                    const { pct, barClass, textClass, label } = getProgressStyles(lvl.usedCapacity, lvl.capacity, "bg-blue-500");

                    return (
                      <div
                        key={lvl.id}
                        onClick={() => navigate(`/data-barang?search=${encodeURIComponent(`${loc.name} - ${lvl.name}`)}`)}
                        className={`p-2.5 rounded-xl border transition-all ${
                          isLvlEffectiveActive 
                            ? 'border-neutral-800/80 bg-neutral-955/20 hover:border-neutral-700/60 hover:bg-neutral-955/40 cursor-pointer' 
                            : 'border-neutral-850/50 bg-neutral-900/5 opacity-55'
                        } flex flex-col gap-2 group/level`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-xs text-neutral-200">{lvl.name}</span>
                          <div className="flex gap-1.5 items-center" onClick={e => e.stopPropagation()}>
                            <span className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-850 text-[10px] text-neutral-400 max-w-[90px] truncate font-medium">
                              {lvl.brandRule}
                            </span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6 rounded-full opacity-60 group-hover/level:opacity-100 transition-opacity hover:bg-neutral-800 text-neutral-400 cursor-pointer"
                                >
                                  <MoreVertical className="w-3 h-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-neutral-955 border-neutral-800 text-neutral-200">
                                <DropdownMenuItem className="cursor-pointer focus:bg-neutral-800 text-xs" onClick={() => handleOpenSheet("edit-level", { parentId: loc.id, levelId: lvl.id })}><Edit className="w-3.5 h-3.5 mr-2" /> Edit Level</DropdownMenuItem>
                                <DropdownMenuItem className="cursor-pointer focus:bg-neutral-800 text-xs" onClick={() => handleDownloadQrCode(lvl.sheetUrl, `${loc.name} - ${lvl.name}`)}><QrCode className="w-3.5 h-3.5 mr-2" /> Simpan QR Code</DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-neutral-800" />
                                <DropdownMenuItem disabled={!isLocActive || isToggling} className="cursor-pointer focus:bg-neutral-800 text-xs" onClick={() => handleToggleLevel(loc.id, lvl.id)}><Power className="w-3.5 h-3.5 mr-2" /> {lvl.isActive ? "Nonaktifkan Level" : "Aktifkan Level"}</DropdownMenuItem>
                                <DropdownMenuItem disabled={isDeleting} className="text-red-400 focus:bg-red-950/50 focus:text-red-400 cursor-pointer text-xs" onClick={() => requestDeleteLevel(lvl.id, lvl.name)}><Trash2 className="w-3.5 h-3.5 mr-2" /> Hapus Level</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Progress Bar & Details */}
                        <div className="flex justify-between items-center text-[10px] text-neutral-500 font-medium">
                          <span>Kapasitas</span>
                          <span>
                            <strong className="text-neutral-300">{lvl.usedCapacity}</strong>
                            <span className="text-neutral-600 font-normal"> / {lvl.capacity} Unit</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-neutral-950 rounded-full overflow-hidden shadow-inner">
                            <div className={`h-full rounded-full transition-all duration-500 ${barClass}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`text-[10px] font-bold w-7 text-right ${textClass}`}>{label}</span>
                        </div>
                      </div>
                    );
                  })}
                  {(!loc.levels || loc.levels.length === 0) && (
                    <div className="text-center p-4 border border-dashed border-neutral-800/80 rounded-xl text-neutral-500 text-xs flex flex-col items-center justify-center gap-1.5 py-8">
                      <Box className="w-6 h-6 text-neutral-800 mb-1" />
                      <p>Belum memiliki level.</p>
                      <Button variant="link" className="text-blue-400 text-[11px] h-auto p-0 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleOpenSheet("add-level", { parentId: loc.id }); }}>
                        Tambah level sekarang
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          }

          if (loc.type === "Kardus") {
            const { pct, barClass, textClass, label } = getProgressStyles(loc.usedCapacity || 0, loc.capacity || 0, "bg-amber-500");

            return (
              <Card
                key={loc.id}
                className={`border-neutral-800 bg-neutral-900/10 overflow-hidden flex flex-col relative group transition-all duration-300 hover:border-neutral-700/80 hover:bg-neutral-900/20 hover:shadow-md hover:shadow-black/20 cursor-pointer ${!isLocActive ? 'opacity-60 saturate-50' : ''}`}
                onClick={() => navigate(`/data-barang?search=${encodeURIComponent(loc.name)}`)}
              >
                <CardContent className="p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-amber-500/10 rounded-lg shrink-0"><Archive className="w-4 h-4 text-amber-400" /></div>
                      <div>
                        <CardTitle className="text-sm font-bold text-neutral-100 flex items-center gap-1.5">
                          {loc.name}
                          {!isLocActive && <span className="text-[10px] bg-neutral-850 text-neutral-500 border border-neutral-800 px-1.5 py-0.2 rounded-md font-medium">Nonaktif</span>}
                        </CardTitle>
                        <CardDescription className="text-[10px] text-neutral-500 mt-0.5">Penyimpanan Kardus</CardDescription>
                      </div>
                    </div>

                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <span className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-850 text-[10px] text-neutral-400 font-medium">
                        {loc.brandRule || "Campuran"}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-neutral-800 text-neutral-400 cursor-pointer"><MoreVertical className="w-3.5 h-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-neutral-955 border-neutral-800 text-neutral-200">
                          <DropdownMenuItem className="cursor-pointer focus:bg-neutral-800 text-xs" onClick={() => handleOpenSheet("edit-kardus", { parentId: loc.id })}><Edit className="w-3.5 h-3.5 mr-2" /> Edit Kardus</DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer focus:bg-neutral-800 text-xs" onClick={() => handleDownloadQrCode(loc.sheetUrl, loc.name)}><QrCode className="w-3.5 h-3.5 mr-2" /> Simpan QR Code</DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-neutral-800" />
                          <DropdownMenuItem disabled={isToggling} className="cursor-pointer focus:bg-neutral-800 text-xs" onClick={() => handleToggleLocation(loc.id)}><Power className="w-3.5 h-3.5 mr-2" /> {isLocActive ? "Nonaktifkan Kardus" : "Aktifkan Kardus"}</DropdownMenuItem>
                          <DropdownMenuItem disabled={isDeleting} className="text-red-400 focus:bg-red-950/50 focus:text-red-400 cursor-pointer text-xs" onClick={() => requestDeleteLocation(loc.id, loc.name)}><Trash2 className="w-3.5 h-3.5 mr-2" /> Hapus Kardus</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="space-y-1.5 mt-auto">
                    <div className="flex justify-between items-center text-[10px] font-medium text-neutral-500">
                      <span>Kapasitas</span>
                      <span>
                        <strong className="text-neutral-300">{loc.usedCapacity || 0}</strong>
                        <span className="text-neutral-600 font-normal"> / {loc.capacity || 0} Unit</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-neutral-950 rounded-full overflow-hidden shadow-inner">
                        <div className={`h-full rounded-full transition-all duration-500 ${barClass}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={`text-[10px] font-bold w-7 text-right ${textClass}`}>{label}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          }

          // Pallet
          if (loc.type === "Pallet") {
            const { pct, barClass, textClass, label } = getProgressStyles(loc.usedCapacity || 0, loc.capacity || 0, "bg-emerald-500");

            return (
              <Card
                key={loc.id}
                className={`border-neutral-800 bg-neutral-900/10 overflow-hidden flex flex-col relative group transition-all duration-300 hover:border-neutral-700/80 hover:bg-neutral-900/20 hover:shadow-md hover:shadow-black/20 cursor-pointer ${!isLocActive ? 'opacity-60 saturate-50' : ''}`}
                onClick={() => navigate(`/data-barang?search=${encodeURIComponent(loc.name)}`)}
              >
                <CardContent className="p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-500/10 rounded-lg shrink-0"><Package className="w-4 h-4 text-emerald-400" /></div>
                      <div>
                        <CardTitle className="text-sm font-bold text-neutral-100 flex items-center gap-1.5">
                          {loc.name}
                          {!isLocActive && <span className="text-[10px] bg-neutral-850 text-neutral-500 border border-neutral-800 px-1.5 py-0.2 rounded-md font-medium">Nonaktif</span>}
                        </CardTitle>
                        <CardDescription className="text-[10px] text-neutral-500 mt-0.5">Penyimpanan Pallet</CardDescription>
                      </div>
                    </div>

                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <span className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-850 text-[10px] text-neutral-400 font-medium">
                        {loc.brandRule || "Campuran"}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-neutral-800 text-neutral-400 cursor-pointer"><MoreVertical className="w-3.5 h-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-neutral-955 border-neutral-800 text-neutral-200">
                          <DropdownMenuItem className="cursor-pointer focus:bg-neutral-800 text-xs" onClick={() => handleOpenSheet("edit-pallet", { parentId: loc.id })}><Edit className="w-3.5 h-3.5 mr-2" /> Edit Pallet</DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer focus:bg-neutral-800 text-xs" onClick={() => handleDownloadQrCode(loc.sheetUrl, loc.name)}><QrCode className="w-3.5 h-3.5 mr-2" /> Simpan QR Code</DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-neutral-800" />
                          <DropdownMenuItem disabled={isToggling} className="cursor-pointer focus:bg-neutral-800 text-xs" onClick={() => handleToggleLocation(loc.id)}><Power className="w-3.5 h-3.5 mr-2" /> {isLocActive ? "Nonaktifkan Pallet" : "Aktifkan Pallet"}</DropdownMenuItem>
                          <DropdownMenuItem disabled={isDeleting} className="text-red-400 focus:bg-red-950/50 focus:text-red-400 cursor-pointer text-xs" onClick={() => requestDeleteLocation(loc.id, loc.name)}><Trash2 className="w-3.5 h-3.5 mr-2" /> Hapus Pallet</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="space-y-1.5 mt-auto">
                    <div className="flex justify-between items-center text-[10px] font-medium text-neutral-500">
                      <span>Kapasitas</span>
                      <span>
                        <strong className="text-neutral-300">{loc.usedCapacity || 0}</strong>
                        <span className="text-neutral-600 font-normal"> / {loc.capacity || 0} Unit</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-neutral-950 rounded-full overflow-hidden shadow-inner">
                        <div className={`h-full rounded-full transition-all duration-500 ${barClass}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={`text-[10px] font-bold w-7 text-right ${textClass}`}>{label}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          }

          return null;
        })}
        {filteredAndSortedLocations.length === 0 && (
          <div className="col-span-full py-24 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-neutral-900 border border-neutral-800 rounded-2xl flex items-center justify-center mb-4"><Search className="w-8 h-8 text-neutral-600" /></div>
            <h3 className="text-lg font-bold text-neutral-200">Tidak Ada Lokasi</h3>
            <p className="text-neutral-500 text-xs max-w-sm mt-1">Kami tidak menemukan lokasi penyimpanan yang sesuai dengan kata kunci atau filter tipe Anda.</p>
          </div>
        )}
      </div>

      {/* ── 5. FORM SHEET ── */}
      <Sheet open={sheetMode !== "closed"} onOpenChange={(open) => !open && setSheetMode("closed")}>
        <SheetContent className="sm:max-w-md border-neutral-800 bg-neutral-950 p-0 flex flex-col text-neutral-200">
          <SheetHeader className="p-6 border-b border-neutral-800/60 bg-neutral-900/10">
            <SheetTitle className="text-lg text-neutral-100">{sheetTitles[sheetMode] || ""}</SheetTitle>
            <SheetDescription className="text-xs text-neutral-400">Silakan isi formulir di bawah ini untuk mengelola detail lokasi penyimpanan.</SheetDescription>
          </SheetHeader>
          <div className="p-6 flex-1 overflow-y-auto"><div className="grid gap-5">{renderForm()}</div></div>
          <SheetFooter className="p-6 border-t border-neutral-850 bg-neutral-900/10 flex sm:justify-end gap-3 sm:gap-2">
            <Button variant="outline" onClick={() => setSheetMode("closed")} disabled={isSaving} className="hover:bg-neutral-800 text-neutral-300 text-xs font-semibold cursor-pointer">Batal</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer">
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : "Simpan Perubahan"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── 6. ALERT DIALOG DELETE ── */}
      <AlertDialog open={deleteAlertData.isOpen} onOpenChange={(open) => !open && setDeleteAlertData({ ...deleteAlertData, isOpen: false })}>
        <AlertDialogContent className="bg-neutral-950 border border-neutral-800 text-neutral-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-neutral-100 text-base">Hapus {deleteAlertData.type === "location" ? "Lokasi" : "Level"}?</AlertDialogTitle>
            <AlertDialogDescription className="text-neutral-400 text-xs">
              Tindakan ini akan menghapus permanen <strong>{deleteAlertData.name}</strong> beserta seluruh data terkait di dalamnya. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={isDeleting} className="hover:bg-neutral-800 text-neutral-300 border-neutral-800 text-xs cursor-pointer">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-500 text-white text-xs cursor-pointer">
              {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menghapus...</> : "Hapus Data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}