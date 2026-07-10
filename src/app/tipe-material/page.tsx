"use client";

import { useState, useMemo, useEffect } from "react";
import { Plus, Edit, Trash2, Search, Box, MoreVertical, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const getBaseUrl = () => {
  const baseUrl = import.meta.env.URL || import.meta.env.VITE_URL || "http://localhost:3000";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteAlertData, setDeleteAlertData] = useState({ isOpen: false, id: "", name: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");

  const loadTypes = async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/material-types`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTypes(data);
      }
    } catch (e) {
      toast.error("Gagal mengambil data tipe material.");
    }
  };

  useEffect(() => { loadTypes(); }, []);

  const filteredTypes = useMemo(() => {
    return types.filter(t => t.nama?.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [types, searchQuery]);

  const handleOpenSheet = (id?: string) => {
    if (id) {
      const t = types.find(x => String(x.id) === String(id));
      if (t) {
        setName(t.nama);
        setEditId(id);
      }
    } else {
      setName("");
      setEditId(null);
    }
    setNameError("");
    setIsSheetOpen(true);
  };

  const handleSave = async () => {
    if (isSaving) return;
    const normalizedName = name.trim();
    if (!normalizedName) {
      setNameError("Nama wajib diisi.");
      return;
    }

    if (types.some(t => String(t.id) !== String(editId) && t.nama.toLowerCase() === normalizedName.toLowerCase())) {
      setNameError("Nama tipe material sudah terdaftar.");
      return;
    }

    setIsSaving(true);
    try {
      const url = `${getBaseUrl()}/material-types${editId ? `/${editId}` : ""}`;
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({ nama: normalizedName })
      });

      if (!res.ok) throw new Error("Gagal menyimpan");
      await loadTypes();
      setIsSheetOpen(false);
      toast.success(`Berhasil ${editId ? "memperbarui" : "menambahkan"} tipe material`);
    } catch (e) {
      toast.error("Gagal menyimpan tipe material");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (isDeleting || !deleteAlertData.id) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${getBaseUrl()}/material-types/${deleteAlertData.id}`, { method: "DELETE", headers: getHeaders() });
      if (!res.ok) throw new Error("Gagal menghapus");
      await loadTypes();
      toast.success("Berhasil menghapus tipe material");
    } catch (e) {
      toast.error("Gagal menghapus tipe material karena sedang digunakan.");
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
          <Input placeholder="Cari tipe material..." className="w-full pl-9 bg-neutral-900 border-neutral-800 focus-visible:ring-1 focus-visible:ring-neutral-700" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <Button className="w-full sm:w-auto gap-2" onClick={() => handleOpenSheet()}>
          <Plus className="w-4 h-4" /> Tambah Tipe Material
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-10">
        {filteredTypes.map(t => (
          <Card key={t.id} className="overflow-hidden relative group transition-all duration-300 hover:border-neutral-700 hover:bg-neutral-900/60">
            <CardContent className="px-5 py-5 flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div className="p-2.5 bg-blue-500/10 rounded-xl shrink-0">
                  <Box className="w-6 h-6 text-blue-400" />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-neutral-800 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-neutral-950 border-neutral-800 text-neutral-200">
                    <DropdownMenuItem className="cursor-pointer focus:bg-neutral-800" onClick={() => handleOpenSheet(t.id)}>
                      <Edit className="w-4 h-4 mr-2" /> Edit Tipe
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-400 focus:bg-red-950/50 focus:text-red-400 cursor-pointer" onClick={() => setDeleteAlertData({ isOpen: true, id: t.id, name: t.nama })}>
                      <Trash2 className="w-4 h-4 mr-2" /> Hapus Tipe
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div>
                <h3 className="font-semibold text-lg text-neutral-100 mb-1">{t.nama}</h3>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredTypes.length === 0 && (
          <div className="col-span-full py-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-neutral-900 rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-neutral-600" />
            </div>
            <h3 className="text-lg font-medium text-neutral-300 mb-1">Tipe Material Tidak Ditemukan</h3>
          </div>
        )}
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-md border-neutral-800 bg-neutral-950 p-0 flex flex-col text-neutral-200">
          <SheetHeader className="p-6 border-b border-neutral-800/60 bg-neutral-900/20">
            <SheetTitle className="text-xl text-neutral-100">{editId ? "Edit Tipe Material" : "Tambah Tipe Material"}</SheetTitle>
            <SheetDescription className="text-neutral-400">Kelola informasi referensi tipe material utama.</SheetDescription>
          </SheetHeader>
          <div className="p-6 flex-1 overflow-y-auto">
            <div className="grid gap-5">
              <div className="space-y-2">
                <Label>Nama Tipe Material</Label>
                <Input value={name} onChange={e => { setName(e.target.value); setNameError(""); }} placeholder="Contoh: Kabel Drop Wire" className={`bg-neutral-900 ${nameError ? "border-destructive" : "border-neutral-800"}`} />
                {nameError && <p className="text-xs text-destructive">{nameError}</p>}
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
