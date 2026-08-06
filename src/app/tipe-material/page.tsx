"use client";

import { useState, useMemo, useEffect } from "react";
import { Plus, Edit, Trash2, Search, MoreVertical, Loader2,  LayoutGrid, List } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  useEffect(() => {
    const savedMode = localStorage.getItem("arxiva_model_view_mode") as "grid" | "table" | null;
    if (savedMode) setViewMode(savedMode);
  }, []);

  const handleViewModeChange = (mode: "grid" | "table") => {
    setViewMode(mode);
    localStorage.setItem("arxiva_model_view_mode", mode);
  };

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
        <div className="flex flex-1 items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
            <Input
              type="search"
              placeholder="Cari model material..."
              className="w-full pl-9 bg-card border-border focus-visible:ring-1 focus-visible:ring-neutral-700 placeholder:text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-1 justify-end gap-2 w-full sm:w-auto">
          <div className="flex flex-wrap gap-1">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleViewModeChange("grid")}
              className={`h-8 px-2.5 rounded-sm active:translate-y-0 active:not-aria-[haspopup]:translate-y-0 transition-none ${viewMode === "grid" ? "bg-neutral-800 text-neutral-100" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutGrid className="size-3.5" />
            </Button>
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleViewModeChange("table")}
              className={`h-8 px-2.5 rounded-sm active:translate-y-0 active:not-aria-[haspopup]:translate-y-0 transition-none ${viewMode === "table" ? "bg-neutral-800 text-neutral-100" : "text-muted-foreground hover:text-foreground"}`}
            >
              <List className="size-3.5" />
            </Button>
          </div>
          <Button className="h-8 gap-2 rounded-sm" onClick={() => handleOpenSheet()}>
            <Plus className="w-4 h-4" /> Tambah Model Material
          </Button>
        </div>
      </div>

      {/* Mobile view toggle */}
      <div className="sm:hidden flex items-center p-1 rounded-lg border border-border bg-muted/50 w-full">
        <Button
          variant={viewMode === "grid" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => handleViewModeChange("grid")}
          className={`flex-1 h-8 active:translate-y-0 active:not-aria-[haspopup]:translate-y-0 transition-none ${viewMode === "grid" ? "bg-neutral-800 text-neutral-100" : "text-muted-foreground hover:text-foreground"}`}
        >
          <LayoutGrid className="size-4 mr-1.5" />
          Grid
        </Button>
        <Button
          variant={viewMode === "table" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => handleViewModeChange("table")}
          className={`flex-1 h-8 active:translate-y-0 active:not-aria-[haspopup]:translate-y-0 transition-none ${viewMode === "table" ? "bg-neutral-800 text-neutral-100" : "text-muted-foreground hover:text-foreground"}`}
        >
          <List className="size-4 mr-1.5" />
          Table
        </Button>
      </div>

      {viewMode === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-10">
          {filteredTypes.map(t => (
            <Card key={t.id} className="overflow-hidden relative group transition-all duration-300 hover:border-border/80 hover:bg-muted/60">
              <CardContent className="px-5 py-2 flex flex-col h-full justify-between gap-15">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-xs text-foreground mb-1.5 leading-tight">{t.nama}</h3>
                    <p className="text-xs text-muted-foreground">
                      {t.brand?.nama || '-'} <span className="text-neutral-600 mx-1">|</span> {t.materialCategory?.nama || '-'}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-neutral-800 text-muted-foreground -mr-2 -mt-1">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-neutral-950 border-border text-foreground">
                      <DropdownMenuItem className="cursor-pointer focus:bg-neutral-800" onClick={() => handleOpenSheet(t.id)}>
                        <Edit className="w-4 h-4 mr-2" /> Edit Model
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-400 focus:bg-red-950/50 focus:text-red-400 cursor-pointer" onClick={() => setDeleteAlertData({ isOpen: true, id: t.id, name: t.nama })}>
                        <Trash2 className="w-4 h-4 mr-2" /> Hapus Model
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-sm text-foreground font-medium">Total {t._count?.items || 0} Unit</span>

                  {t.code && (
                    <span className="text-xs ml-auto px-2 pb-1 pt-1.5 rounded border border-border">
                      {t.code}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredTypes.length === 0 && (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-card rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-neutral-600" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">Model Material Tidak Ditemukan</h3>
              <p className="text-sm text-neutral-500 max-w-sm">Coba gunakan kata kunci lain atau tambahkan model material baru.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-sm border border-border bg-muted/50 overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/80">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">No.</TableHead>
                <TableHead className="text-muted-foreground">Kode Model</TableHead>
                <TableHead className="text-muted-foreground">Nama Model</TableHead>
                <TableHead className="text-muted-foreground">Merek</TableHead>
                <TableHead className="text-muted-foreground">Kategori</TableHead>
                <TableHead className="text-muted-foreground">Total Unit</TableHead>
                <TableHead className="text-right text-muted-foreground">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTypes.length === 0 ? (
                <TableRow className="border-border hover:bg-transparent">
                  <TableCell colSpan={7} className="h-32 text-center text-neutral-500">
                    <div className="flex flex-col items-center justify-center">
                      <Search className="w-8 h-8 text-neutral-600 mb-2" />
                      <p>Model Material Tidak Ditemukan</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTypes.map((t, index) => (
                  <TableRow key={t.id} className="border-border hover:bg-muted/80">
                    <TableCell className="text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.code || '-'}
                    </TableCell>
                    <TableCell className="text-foreground">
                      <div className="flex items-center gap-3">
                        {t.nama}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.brand?.nama || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.materialCategory?.nama || '-'}
                    </TableCell>
                    <TableCell className="text-foreground font-medium">
                      {t._count?.items || 0} Unit
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" className="h-7 w-7 rounded-sm hover:bg-neutral-800 text-muted-foreground cursor-pointer">
                            <MoreVertical className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-sm bg-card border-accent-foreground text-foreground">
                          <DropdownMenuItem className="px-2 h-8 rounded-sm cursor-pointer focus:bg-neutral-800" onClick={() => handleOpenSheet(t.id)}>
                            <Edit className="size-3.5 mr-1" />
                            <span className="text-xs">Edit Model Material</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="px-2 h-8 rounded-sm text-red-400 focus:bg-red-950/50 focus:text-red-400 cursor-pointer" onClick={() => setDeleteAlertData({ isOpen: true, id: t.id, name: t.nama })}>
                            <Trash2 className="size-3.5 mr-1" />
                            <span className="text-xs">Hapus Model Material</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-md border-border bg-neutral-950 p-0 flex flex-col text-foreground">
          <SheetHeader className="p-6 border-b border-border/60 bg-muted/20">
            <SheetTitle className="text-xl text-neutral-100">{editId ? "Edit Model Material" : "Tambah Model Material"}</SheetTitle>
            <SheetDescription className="text-muted-foreground">Kelola informasi referensi model material utama.</SheetDescription>
          </SheetHeader>
          <div className="p-6 flex-1 overflow-y-auto">
            <div className="grid gap-5">
              <div className="space-y-2">
                <Label>Kode Material</Label>
                <Input value={code} onChange={e => setCode(e.target.value)} placeholder="Masukkan Kode Material" className="bg-card border-border" />
              </div>

              <div className="space-y-2">
                <Label>Nama Material</Label>
                <Input value={name} onChange={e => { setName(e.target.value); setNameError(""); }} placeholder="Masukkan Nama Material" className={`bg-card ${nameError ? "border-destructive" : "border-border"}`} />
                {nameError && <p className="text-xs text-destructive">{nameError}</p>}
              </div>

              <div className="space-y-2">
                <Label>Brand</Label>
                <Select value={brandId} onValueChange={(val) => { setBrandId(val); setBrandError(""); }}>
                  <SelectTrigger className={`bg-card ${brandError ? "border-destructive" : "border-border"}`}>
                    <SelectValue placeholder="Pilih Merek Material" />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-950 border-border">
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
                  <SelectTrigger className={`bg-card ${categoryError ? "border-destructive" : "border-border"}`}>
                    <SelectValue placeholder="Pilih Kategori Material" />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-950 border-border">
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {categoryError && <p className="text-xs text-destructive">{categoryError}</p>}
              </div>


            </div>
          </div>
          <SheetFooter className="p-6 border-t border-border/60 bg-muted/20 flex sm:justify-end gap-3 sm:gap-2">
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
            <AlertDialogDescription className="text-muted-foreground">Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
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
