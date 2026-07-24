"use client";

import { useState, useMemo, useEffect } from "react";
import { Plus, Edit, Trash2, Search, MoreVertical, Loader2, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const getBaseUrl = () => {
  const baseUrl = import.meta.env.URL || import.meta.env.VITE_URL || "http://172.168.9.139:3000/";
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
};

const getHeaders = () => {
  const token = localStorage.getItem("arxiva-auth-token");
  return {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": token } : {})
  };
};

export default function TipeMaterialPage() {
  const [types, setTypes] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteAlertData, setDeleteAlertData] = useState({ isOpen: false, id: "", name: "" });

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [brandId, setBrandId] = useState("");
  const [materialCategoryId, setMaterialCategoryId] = useState("");

  const [nameError, setNameError] = useState("");
  const [brandError, setBrandError] = useState("");
  const [categoryError, setCategoryError] = useState("");

  const loadTypes = async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/material-models`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTypes(data);
      }
    } catch (e) {
      toast.error("Gagal mengambil data model material.");
    }
  };

  const loadBrands = async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/brands`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.data || data.brands || []);
        setBrands(list);
      }
    } catch (e) { }
  };

  const loadCategories = async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/categories`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.data || data.categories || []);
        setCategories(list);
      }
    } catch (e) { }
  };

  useEffect(() => {
    loadTypes();
    loadBrands();
    loadCategories();
  }, []);

  const filteredTypes = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return types.filter(t =>
      t.nama?.toLowerCase().includes(q) ||
      t.code?.toLowerCase().includes(q) ||
      t.brand?.nama?.toLowerCase().includes(q) ||
      t.materialCategory?.nama?.toLowerCase().includes(q)
    );
  }, [types, searchQuery]);

  const handleOpenSheet = (id?: string) => {
    setNameError("");
    setBrandError("");
    setCategoryError("");

    if (id) {
      const t = types.find(x => String(x.id) === String(id));
      if (t) {
        setName(t.nama || "");
        setCode(t.code || "");
        setBrandId(t.brandId ? String(t.brandId) : "");
        setMaterialCategoryId(t.materialCategoryId ? String(t.materialCategoryId) : "");
        setEditId(id);
      }
    } else {
      setName("");
      setCode("");
      setBrandId("");
      setMaterialCategoryId("");
      setEditId(null);
    }
    setIsSheetOpen(true);
  };

  const handleSave = async () => {
    if (isSaving) return;
    const normalizedName = name.trim();

    let hasError = false;
    if (!brandId) {
      setBrandError("Merek wajib dipilih.");
      hasError = true;
    }
    if (!materialCategoryId) {
      setCategoryError("Kategori wajib dipilih.");
      hasError = true;
    }
    if (!normalizedName) {
      setNameError("Nama model material wajib diisi.");
      hasError = true;
    }

    if (hasError) return;

    if (types.some(t => String(t.id) !== String(editId) && t.nama.toLowerCase() === normalizedName.toLowerCase())) {
      setNameError("Nama model material sudah terdaftar.");
      return;
    }

    setIsSaving(true);
    try {
      const url = `${getBaseUrl()}/material-models${editId ? `/${editId}` : ""}`;
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({
          nama: normalizedName,
          code: code.trim() || undefined,
          brandId: parseInt(brandId),
          materialCategoryId: parseInt(materialCategoryId)
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Gagal menyimpan model material");
      }

      await loadTypes();
      setIsSheetOpen(false);
      toast.success(`Berhasil ${editId ? "memperbarui" : "menambahkan"} model material`);
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan model material");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (isDeleting || !deleteAlertData.id) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${getBaseUrl()}/material-models/${deleteAlertData.id}`, { method: "DELETE", headers: getHeaders() });
      if (!res.ok) throw new Error("Gagal menghapus");
      await loadTypes();
      toast.success("Berhasil menghapus model material");
    } catch (e) {
      toast.error("Gagal menghapus model material karena sedang digunakan.");
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
          <Input placeholder="Cari model material..." className="w-full pl-9 bg-neutral-900 border-neutral-800 focus-visible:ring-1 focus-visible:ring-neutral-700" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <Button className="w-full sm:w-auto gap-2" onClick={() => handleOpenSheet()}>
          <Plus className="w-4 h-4" /> Tambah Model Material
        </Button>
      </div>

      <div className="relative min-h-0 flex-1 rounded-md border border-border/60 bg-card/40 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-md">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16 text-center text-xs font-semibold">No.</TableHead>
              <TableHead className="text-xs font-semibold">Kode Model</TableHead>
              <TableHead className="text-xs font-semibold">Nama Model</TableHead>
              <TableHead className="text-xs font-semibold">Merek</TableHead>
              <TableHead className="text-xs font-semibold">Kategori</TableHead>
              <TableHead className="text-right text-xs font-semibold">Total Unit</TableHead>
              <TableHead className="w-16 text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTypes.map((t, index) => (
              <TableRow key={t.id} className="hover:bg-muted/40 transition-colors text-xs md:text-sm">
                <TableCell className="text-center font-medium text-muted-foreground text-xs">
                  {index + 1}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {t.code || '-'}
                </TableCell>
                <TableCell className="font-medium text-foreground">
                  {t.nama}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {t.brand?.nama || '-'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {t.materialCategory?.nama || '-'}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {t._count?.items || 0} Unit
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-neutral-800 text-neutral-400">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-neutral-950 border-neutral-800 text-neutral-200">
                      <DropdownMenuItem className="cursor-pointer focus:bg-neutral-800" onClick={() => handleOpenSheet(t.id)}>
                        <Edit className="w-4 h-4 mr-2" /> Edit Model Material
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-400 focus:bg-red-950/50 focus:text-red-400 cursor-pointer" onClick={() => setDeleteAlertData({ isOpen: true, id: t.id, name: t.nama })}>
                        <Trash2 className="w-4 h-4 mr-2" /> Hapus Model Material
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filteredTypes.length === 0 && (
          <div className="flex min-h-[300px] items-center justify-center px-6 py-12">
            <div className="flex max-w-md flex-col items-center gap-3 text-center">
              <div className="flex size-12 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
                <PackageOpen className="size-6" strokeWidth={1.8} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Model Material Tidak Ditemukan
                </p>
                <p className="text-xs text-muted-foreground">
                  Data model material tidak ditemukan atau belum ada data yang ditambahkan.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-md border-neutral-800 bg-neutral-950 p-0 flex flex-col text-neutral-200">
          <SheetHeader className="p-6 border-b border-neutral-800/60 bg-neutral-900/20">
            <SheetTitle className="text-xl text-neutral-100">{editId ? "Edit Model Material" : "Tambah Model Material"}</SheetTitle>
            <SheetDescription className="text-neutral-400">Kelola informasi referensi model material utama.</SheetDescription>
          </SheetHeader>
          <div className="p-6 flex-1 overflow-y-auto">
            <div className="grid gap-5">
              <div className="space-y-2">
                <Label>Kode Material</Label>
                <Input value={code} onChange={e => setCode(e.target.value)} placeholder="Masukkan Kode Material" className="bg-neutral-900 border-neutral-800" />
              </div>

              <div className="space-y-2">
                <Label>Nama Material</Label>
                <Input value={name} onChange={e => { setName(e.target.value); setNameError(""); }} placeholder="Masukkan Nama Material" className={`bg-neutral-900 ${nameError ? "border-destructive" : "border-neutral-800"}`} />
                {nameError && <p className="text-xs text-destructive">{nameError}</p>}
              </div>

              <div className="space-y-2">
                <Label>Brand</Label>
                <Select value={brandId} onValueChange={(val) => { setBrandId(val); setBrandError(""); }}>
                  <SelectTrigger className={`bg-neutral-900 ${brandError ? "border-destructive" : "border-neutral-800"}`}>
                    <SelectValue placeholder="Pilih Merek Material" />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-950 border-neutral-800">
                    {brands.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>{b.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {brandError && <p className="text-xs text-destructive">{brandError}</p>}
              </div>

              <div className="space-y-2">
                <Label>Kategori Material</Label>
                <Select value={materialCategoryId} onValueChange={(val) => { setMaterialCategoryId(val); setCategoryError(""); }}>
                  <SelectTrigger className={`bg-neutral-900 ${categoryError ? "border-destructive" : "border-neutral-800"}`}>
                    <SelectValue placeholder="Pilih Kategori Material" />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-950 border-neutral-800">
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {categoryError && <p className="text-xs text-destructive">{categoryError}</p>}
              </div>


            </div>
          </div>
          <SheetFooter className="p-6 border-t border-neutral-800/60 bg-neutral-900/20 flex sm:justify-end gap-3 sm:gap-2">
            <Button variant="outline" onClick={() => setIsSheetOpen(false)} disabled={isSaving}>Batal</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Simpan
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteAlertData.isOpen} onOpenChange={(open) => !open && !isDeleting && setDeleteAlertData({ ...deleteAlertData, isOpen: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle>
            <AlertDialogDescription className="text-neutral-400">Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>Lanjutkan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
