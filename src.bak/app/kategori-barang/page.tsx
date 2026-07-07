"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Plus, Edit, Trash2, Search, Shapes, MoreVertical, ShieldAlert, Loader2
} from "lucide-react";

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

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
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

import type { Kategori } from "@/types/inventory";

/**
 * Komponen KategoriBarangPage
 * 
 * Halaman untuk mengelola Master Data Kategori. Memungkinkan pengguna
 * untuk melihat, mencari, menambah, mengedit, dan menghapus kategori.
 * Termasuk pengaturan threshold 'Safety Stock' per kategori.
 * 
 * @returns {JSX.Element} Antarmuka halaman manajemen kategori.
 */
export default function KategoriBarangPage() {
  const [categories, setCategories] = useState<Kategori[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Sheet state
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Alert state
  const [deleteAlertData, setDeleteAlertData] = useState<{ isOpen: boolean; id: string; name: string }>({ isOpen: false, id: "", name: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [safetyStock, setSafetyStock] = useState(5);
  const [nameError, setNameError] = useState("");
  const [safetyStockError, setSafetyStockError] = useState("");

  /**
   * Mengambil data seluruh kategori dari API Backend.
   * Melakukan standarisasi format payload balikan agar sesuai dengan interface UI.
   */
  const loadCategories = async () => {
    try {
      const response = await fetch(`${getBaseUrl()}/categories`, {
        method: "GET",
        headers: getHeaders(),
      });
      if (!response.ok) {
        throw new Error("Gagal mengambil data kategori");
      }
      const data = await response.json();
      
      // Standarisasi response (mengingat format backend kadang bisa bervariasi)
      const categoriesList = data.data || data.categories || data;
      setCategories(Array.isArray(categoriesList) ? categoriesList.map((c: any) => ({
        ...c,
        id: String(c.id),
        name: c.nama || c.name || "",
        description: c.deskripsi || c.description || "",
        totalItems: c.totalItems !== undefined ? c.totalItems : (c.total_items || 0),
        safetyStock: c.safetyStock !== undefined ? c.safetyStock : (c.safety_stock || 5),
      })) : []);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
      toast.error("Gagal mengambil data kategori dari server.");
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const filteredCategories = useMemo(() => {
    return categories.filter(cat =>
      cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [categories, searchQuery]);

  const handleOpenSheet = (id?: string) => {
    if (id) {
      const cat = categories.find(c => c.id === id);
      if (cat) {
        setName(cat.name);
        setDescription(cat.description);
        setSafetyStock(cat.safetyStock);
        setEditId(id);
      }
    } else {
      setName("");
      setDescription("");
      setSafetyStock(5);
      setEditId(null);
    }
    setNameError("");
    setSafetyStockError("");
    setIsSheetOpen(true);
  };

  /**
   * Menyimpan data form ke API Backend (Berfungsi untuk Tambah & Edit).
   * Melakukan validasi *duplicate name* di sisi klien sebelum memanggil API.
   */
  const handleSave = async () => {
    if (isSaving) return;
    const normalizedName = name.trim();
    if (!normalizedName) {
      setNameError("Nama kategori wajib diisi.");
      toast.error("Nama kategori wajib diisi.");
      return;
    }
    if (!Number.isInteger(safetyStock) || safetyStock < 0) {
      setSafetyStockError("Safety stock harus berupa angka 0 atau lebih.");
      toast.error("Nilai safety stock tidak valid.");
      return;
    }

    // Cek duplikasi: Cegah pembuatan kategori dengan nama yang sama persis
    const duplicateCategory = categories.some(
      (category) =>
        category.id !== editId &&
        category.name.trim().toLowerCase() === normalizedName.toLowerCase()
    );
    if (duplicateCategory) {
      setNameError("Nama kategori sudah terdaftar.");
      toast.error("Kategori dengan nama tersebut sudah terdaftar.");
      return;
    }

    setIsSaving(true);
    try {
      if (editId) {
        const cat = categories.find(c => c.id === editId);
        const response = await fetch(`${getBaseUrl()}/categories/${editId}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify({
            nama: normalizedName,
            name: normalizedName,
            deskripsi: description.trim() || "-",
            description: description.trim() || "-",
            totalItems: cat?.totalItems || 0,
            safetyStock,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || "Gagal memperbarui kategori");
        }
      } else {
        const response = await fetch(`${getBaseUrl()}/categories`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            nama: normalizedName,
            name: normalizedName,
            deskripsi: description.trim() || "-",
            description: description.trim() || "-",
            totalItems: 0,
            safetyStock,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || "Gagal menambahkan kategori");
        }
      }
      await loadCategories();
      setIsSheetOpen(false);
      toast.success(`Berhasil ${editId ? "menyimpan perubahan" : "menambahkan"} data kategori`);
    } catch (error: any) {
      console.error("Failed to save category:", error);
      toast.error(error.message || (typeof error === "string" ? error : "Gagal menyimpan kategori."));
    } finally {
      setIsSaving(false);
    }
  };

  const requestDelete = (id: string, name: string) => {
    setDeleteAlertData({ isOpen: true, id, name });
  };

  const confirmDelete = async () => {
    if (isDeleting) return;
    const { id } = deleteAlertData;
    if (!id) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`${getBaseUrl()}/categories/${id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || "Gagal menghapus kategori");
      }

      await loadCategories();
      toast.success("Berhasil menghapus kategori");
    } catch (error: any) {
      console.error("Failed to delete category:", error);
      toast.error(error.message || "Gagal menghapus kategori.");
    } finally {
      setIsDeleting(false);
      setDeleteAlertData({ isOpen: false, id: "", name: "" });
    }
  };


  return (
    <div className="p-6 h-full flex flex-col gap-6 text-neutral-100 mx-auto w-full">

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <Input
            type="search"
            placeholder="Cari kategori..."
            className="w-full pl-9 bg-neutral-900 border-neutral-800 focus-visible:ring-1 focus-visible:ring-neutral-700"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button className="w-full sm:w-auto gap-2" onClick={() => handleOpenSheet()}>
          <Plus className="w-4 h-4" /> Tambah Kategori
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-10">
        {filteredCategories.map(cat => (
          <Card key={cat.id} className="overflow-hidden relative group transition-all duration-300 hover:border-neutral-700 hover:bg-neutral-900/60">
            <CardContent className="px-5 flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div className="p-2.5 bg-blue-500/10 rounded-xl shrink-0">
                  <Shapes className="w-6 h-6 text-blue-400" />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-neutral-800 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-neutral-950 border-neutral-800 text-neutral-200">
                    <DropdownMenuItem className="cursor-pointer focus:bg-neutral-800" onClick={() => handleOpenSheet(cat.id)}>
                      <Edit className="w-4 h-4 mr-2" /> Edit Kategori
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-400 focus:bg-red-950/50 focus:text-red-400 cursor-pointer" onClick={() => requestDelete(cat.id, cat.name)}>
                      <Trash2 className="w-4 h-4 mr-2" /> Hapus Kategori
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div>
                <h3 className="font-semibold text-lg text-neutral-100 mb-1">{cat.name}</h3>
                <p className="text-sm text-neutral-500 line-clamp-2">{cat.description}</p>
              </div>

              <div className="mt-auto pt-4 border-t border-neutral-800/60 flex justify-between items-center">
                <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                  <ShieldAlert className="size-3.5 text-amber-400" />
                  Safety Stock
                </div>
                <span className="text-sm font-medium text-neutral-300">
                  {cat.safetyStock} Unit
                </span>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredCategories.length === 0 && (
          <div className="col-span-full py-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-neutral-900 rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-neutral-600" />
            </div>
            <h3 className="text-lg font-medium text-neutral-300 mb-1">Kategori Tidak Ditemukan</h3>
            <p className="text-sm text-neutral-500 max-w-sm">Coba gunakan kata kunci lain atau tambahkan kategori baru.</p>
          </div>
        )}
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-md border-neutral-800 bg-neutral-950 p-0 flex flex-col text-neutral-200">
          <SheetHeader className="p-6 border-b border-neutral-800/60 bg-neutral-900/20">
            <SheetTitle className="text-xl text-neutral-100">{editId ? "Edit Kategori" : "Tambah Kategori Baru"}</SheetTitle>
            <SheetDescription className="text-neutral-400">
              Isi formulir di bawah ini untuk mengelola informasi kategori.
            </SheetDescription>
          </SheetHeader>
          <div className="p-6 flex-1 overflow-y-auto">
            <div className="grid gap-5">
              <div className="space-y-2">
                <Label>Nama Kategori</Label>
                <Input
                  value={name}
                  onChange={e => {
                    setName(e.target.value)
                    setNameError("")
                  }}
                  placeholder="Contoh: Router & Switch"
                  className={`bg-neutral-900 ${nameError ? "border-destructive" : "border-neutral-800"}`}
                />
                {nameError && (
                  <p className="text-xs text-destructive">{nameError}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Deskripsi</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Masukkan deskripsi..." className="bg-neutral-900 border-neutral-800" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="safety-stock">Safety Stock Minimum</Label>
                <Input
                  id="safety-stock"
                  type="number"
                  min={0}
                  step={1}
                  value={safetyStock}
                  onChange={(event) => {
                    setSafetyStock(Number(event.target.value))
                    setSafetyStockError("")
                  }}
                  className={`bg-neutral-900 ${safetyStockError ? "border-destructive" : "border-neutral-800"}`}
                />
                <p className="text-xs text-neutral-500">
                  Indikator akan menandai stok menipis ketika jumlah barang tersedia
                  sama atau di bawah batas ini.
                </p>
                {safetyStockError && (
                  <p className="text-xs text-destructive">{safetyStockError}</p>
                )}
              </div>
            </div>
          </div>
          <SheetFooter className="p-6 border-t border-neutral-800/60 bg-neutral-900/20 flex sm:justify-end gap-3 sm:gap-2">
            <Button variant="outline" onClick={() => setIsSheetOpen(false)} className="hover:bg-neutral-800 text-neutral-300" disabled={isSaving}>Batal</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Simpan Perubahan
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteAlertData.isOpen} onOpenChange={(open) => !open && !isDeleting && setDeleteAlertData({ ...deleteAlertData, isOpen: false })}>
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
              {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Lanjutkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
