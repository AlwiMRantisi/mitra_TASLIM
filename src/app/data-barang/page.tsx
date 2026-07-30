"use client"

import { useState, useEffect } from "react"
import { Plus, Search, Edit, Trash2, Boxes, Loader2, ChevronLeft, ChevronRight, MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { useSearchParams } from "react-router-dom"
import { useAuth } from "@/lib/auth"


import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { BarangDetailDrawer } from "@/components/data-barang/BarangDetailDrawer"
import { BarangFormModal } from "@/components/data-barang/BarangFormModal"

import type { StatusUnit, BarangUnit, StorageLocationOption } from "@/types/inventory"
import type { DeleteDialogState } from "@/types/ui"

const STATUS_OPTIONS: StatusUnit[] = ["Tersedia", "Terdistribusi", "Rusak", "Hilang"]
const ADMIN_LOCATION = "KP Tasikmalaya"

const getBaseUrl = () => {
  const baseUrl = import.meta.env.URL || import.meta.env.VITE_URL || "http://172.168.9.139:3000/"
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
}

const getHeaders = () => {
  const token = localStorage.getItem("arxiva-auth-token")
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (token) {
    headers["Authorization"] = `${token}`
  }
  return headers
}

const getLokasiPenyimpanan = (status: StatusUnit, lokasiPenyimpanan: string) =>
  status === "Terdistribusi" ? "Terdistribusi" : lokasiPenyimpanan.trim()

export default function DataBarangPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()

  const [barangList, setBarangList] = useState<BarangUnit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterCategory, setFilterCategory] = useState("all")
  const [filterBrand, setFilterBrand] = useState("all")
  const [categories, setCategories] = useState<string[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [dbLocations, setDbLocations] = useState<StorageLocationOption[]>([])

  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Drawer detail state
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [detailBarang, setDetailBarang] = useState<BarangUnit | null>(null)

  // Form modal state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<"add" | "edit">("add")
  const [selectedBarang, setSelectedBarang] = useState<BarangUnit | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState({
    serialNumber: "",
    kategori: "",
    merek: "",
    tipe: "",
    status: "Tersedia" as StatusUnit,
    lokasiPenyimpanan: "",
    tanggalMasuk: "",
    tanggalKeluar: "",
  })

  // Load auxiliary data (Categories & Locations) once
  useEffect(() => {
    const fetchAuxiliary = async () => {
      try {
        const [resCat, resLoc] = await Promise.all([
          fetch(`${getBaseUrl()}/categories`, { method: "GET", headers: getHeaders() }),
          fetch(`${getBaseUrl()}/locations`, { method: "GET", headers: getHeaders() }),
        ])

        if (resCat.ok) {
          const rawCat = await resCat.json()
          const catData = rawCat.data || rawCat
          if (Array.isArray(catData)) {
            setCategories(catData.map((c: any) => c.nama || c.name || ""))
          }
        }

        if (resLoc.ok) {
          const rawLoc = await resLoc.json()
          const locationsData = rawLoc.data || rawLoc
          const locs: StorageLocationOption[] = []
          if (Array.isArray(locationsData)) {
            locationsData.forEach((loc: any) => {
              const owner = loc.owner || ADMIN_LOCATION
              if (loc.type === "Rak" && loc.levels) {
                loc.levels.forEach((lvl: any) =>
                  locs.push({ name: `${loc.name} - ${lvl.name}`, owner })
                )
              } else {
                locs.push({ name: loc.name, owner })
              }
            })
            setDbLocations(locs)
          }
        }
      } catch (err) {
        console.error("Gagal memuat kategori/lokasi:", err)
      }
    }

    fetchAuxiliary()
  }, [])

  // Load main paginated items list
  const loadItems = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.append("page", currentPage.toString())
      params.append("limit", pageSize.toString())
      if (searchTerm.trim()) params.append("search", searchTerm.trim())
      if (filterStatus !== "all") params.append("status", filterStatus)
      if (filterCategory !== "all") params.append("kategori", filterCategory)
      if (filterBrand !== "all") params.append("merek", filterBrand)

      const res = await fetch(`${getBaseUrl()}/items?${params.toString()}`, {
        method: "GET",
        headers: getHeaders(),
      })

      if (!res.ok) throw new Error("Gagal memuat data barang")

      const result = await res.json()
      if (result && Array.isArray(result.data)) {
        setBarangList(result.data)
        setTotalItems(result.pagination?.totalItems || result.data.length)
        setTotalPages(result.pagination?.totalPages || 1)

        const extractedBrands = Array.from(
          new Set(result.data.map((item: BarangUnit) => item.merek).filter(Boolean))
        ) as string[]
        if (extractedBrands.length > 0) {
          setBrands((prev) => Array.from(new Set([...prev, ...extractedBrands])))
        }
      } else {
        setBarangList(Array.isArray(result) ? result : [])
        setTotalItems(Array.isArray(result) ? result.length : 0)
        setTotalPages(1)
      }
    } catch (error) {
      console.error("Gagal memuat data:", error)
      toast.error("Gagal memuat data barang")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
  }, [user, currentPage, pageSize, searchTerm, filterStatus, filterCategory, filterBrand])

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterStatus, filterCategory, filterBrand, pageSize])

  const handleOpenDetail = (barang: BarangUnit) => {
    setDetailBarang(barang)
    setIsDetailOpen(true)
  }

  const handleOpenEdit = (barang: BarangUnit) => {
    setFormMode("edit")
    setSelectedBarang(barang)
    setFormData({
      serialNumber: barang.serialNumber,
      kategori: barang.kategori,
      merek: barang.merek,
      tipe: barang.tipe || "",
      status: barang.status,
      lokasiPenyimpanan: getLokasiPenyimpanan(barang.status, barang.lokasiPenyimpanan),
      tanggalMasuk: barang.tanggalMasuk,
      tanggalKeluar: barang.tanggalKeluar || "",
    })
    setFormErrors({})
    setIsFormOpen(true)
  }

  const handleDelete = (id: string, serialNumber: string) => {
    setDeleteDialog({
      type: "single",
      ids: [id],
      serialNumber,
    })
  }

  const confirmDelete = async () => {
    if (!deleteDialog || isDeleting) return
    const idsToDelete = deleteDialog.ids
    setIsDeleting(true)

    try {
      await Promise.all(
        idsToDelete.map((id) =>
          fetch(`${getBaseUrl()}/items/${id}`, {
            method: "DELETE",
            headers: getHeaders(),
          })
        )
      )

      setDeleteDialog(null)
      toast.success("Unit berhasil dihapus.")
      loadItems()
    } catch (err) {
      toast.error("Gagal menghapus unit.")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSaving) return

    const errors: Record<string, string> = {}
    const lokasiPenyimpanan = getLokasiPenyimpanan(formData.status, formData.lokasiPenyimpanan)

    if (!formData.serialNumber.trim()) errors.serialNumber = "Serial number wajib diisi"
    if (!formData.kategori.trim()) errors.kategori = "Kategori wajib diisi"
    if (!formData.merek.trim()) errors.merek = "Merek barang wajib diisi"
    if (!lokasiPenyimpanan) errors.lokasiPenyimpanan = "Lokasi penyimpanan wajib diisi"
    if (!formData.tanggalMasuk.trim()) errors.tanggalMasuk = "Tanggal masuk wajib diisi"

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      toast.error("Gagal menyimpan. Silakan periksa kembali form Anda.")
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        serialNumber: formData.serialNumber.toUpperCase(),
        kategori: formData.kategori,
        merek: formData.merek,
        tipe: formData.tipe || undefined,
        status: formData.status,
        lokasiPenyimpanan,
        tanggalMasuk: formData.tanggalMasuk,
        tanggalKeluar: formData.tanggalKeluar || undefined,
        mitra: user?.role === "mitra" ? user.displayName : ADMIN_LOCATION,
      }

      if (formMode === "add") {
        const resAdd = await fetch(`${getBaseUrl()}/items`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(payload),
        })
        if (!resAdd.ok) throw new Error("Gagal menyimpan unit.")
        toast.success(`Unit baru berhasil didaftarkan!`)
      } else {
        const resUpdate = await fetch(`${getBaseUrl()}/items/${selectedBarang!.id}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify(payload),
        })
        if (!resUpdate.ok) throw new Error("Gagal memperbarui unit.")
        toast.success(`Unit berhasil diperbarui!`)
      }

      setIsFormOpen(false)
      loadItems()
    } catch (error: any) {
      toast.error(error.message || "Gagal menyimpan unit.")
    } finally {
      setIsSaving(false)
    }
  }

  const getStatusBadgeProps = (status: StatusUnit) => {
    switch (status) {
      case "Tersedia":
        return { text: "Tersedia", dotClass: "bg-emerald-500", badgeClass: "bg-emerald-400/10 text-emerald-500" }
      case "Terdistribusi":
        return { text: "Terdistribusi", dotClass: "bg-sky-500", badgeClass: "bg-blue-400/10 text-blue-500" }
      case "Rusak":
        return { text: "Rusak", dotClass: "bg-destructive", badgeClass: "bg-destructive/10 text-destructive" }
      case "Hilang":
      default:
        return { text: "Hilang", dotClass: "bg-amber-500", badgeClass: "bg-amber-400/10 text-amber-500" }
    }
  }

  const formatTanggal = (tgl: string) => {
    if (!tgl) return "-"
    const date = new Date(tgl)
    if (isNaN(date.getTime())) return tgl
    return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
  }

  const isFiltered = searchTerm.trim().length > 0 || filterStatus !== "all" || filterCategory !== "all" || filterBrand !== "all"

  return (
    <div className="p-6 h-full flex flex-col gap-6 text-neutral-100 mx-auto w-full">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center w-full lg:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
            <Input
              type="search"
              placeholder="Cari SN atau barang..."
              className="w-full pl-9 bg-neutral-900 border-neutral-800 focus-visible:ring-1 focus-visible:ring-neutral-700 placeholder:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className={`w-32 rounded-sm bg-neutral-900 border-neutral-800 text-neutral-200 ${filterStatus === 'all' ? 'border-dashed text-neutral-400' : ''}`}>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-200">
                <SelectItem value="all">Status</SelectItem>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className={`w-32 rounded-sm bg-neutral-900 border-neutral-800 text-neutral-200 ${filterCategory === 'all' ? 'border-dashed text-neutral-400' : ''}`}>
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-200">
                <SelectItem value="all">Kategori</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterBrand} onValueChange={setFilterBrand}>
              <SelectTrigger className={`w-32 rounded-sm bg-neutral-900 border-neutral-800 text-neutral-200 ${filterBrand === 'all' ? 'border-dashed text-neutral-400' : ''}`}>
                <SelectValue placeholder="Merek" />
              </SelectTrigger>
              <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-200">
                <SelectItem value="all">Merek</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2 w-full lg:w-auto">
          {user?.role === "admin" && (
            <Button className="h-8 gap-2 rounded-sm" onClick={() => { setFormMode("add"); setIsFormOpen(true); }}>
              <Plus className="w-4 h-4" /> Tambah Barang
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-sm border border-neutral-800 bg-neutral-900/50 overflow-hidden">
        <Table>
          <TableHeader className="bg-neutral-900/80">
            <TableRow className="border-neutral-800 hover:bg-transparent">
              <TableHead className="text-neutral-400 w-12">No.</TableHead>
              <TableHead className="text-neutral-400">Serial Number (SN)</TableHead>
              <TableHead className="text-neutral-400">Merek</TableHead>
              <TableHead className="text-neutral-400">Kategori</TableHead>
              <TableHead className="text-neutral-400 text-center">Status</TableHead>
              <TableHead className="text-neutral-400 text-center">Lokasi Penyimpanan</TableHead>
              {user?.role === "admin" && <TableHead className="text-right text-neutral-400">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow className="border-neutral-800 hover:bg-transparent">
                <TableCell colSpan={7} className="h-32 text-center text-neutral-500">
                  <div className="flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 text-neutral-600 mb-2 animate-spin" />
                    <p>Memuat data barang...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : barangList.length === 0 ? (
              <TableRow className="border-neutral-800 hover:bg-transparent">
                <TableCell colSpan={7} className="h-32 text-center text-neutral-500">
                  <div className="flex flex-col items-center justify-center">
                    <Boxes className="w-8 h-8 text-neutral-600 mb-2" />
                    <p>{isFiltered ? "Tidak ada unit yang cocok" : "Belum ada data barang"}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              barangList.map((item, index) => {
                const badge = getStatusBadgeProps(item.status)
                return (
                  <TableRow 
                    key={item.id} 
                    className="border-neutral-800 hover:bg-neutral-900/80 cursor-pointer"
                    onClick={() => handleOpenDetail(item)}
                  >
                    <TableCell className="text-neutral-400">{(currentPage - 1) * pageSize + index + 1}</TableCell>
                    <TableCell className="text-neutral-200 font-medium">{item.serialNumber}</TableCell>
                    <TableCell className="text-neutral-400">{item.merek || "-"}</TableCell>
                    <TableCell className="text-neutral-400">{item.kategori || "-"}</TableCell>
                    <TableCell className="text-center">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border border-neutral-800/60 ${badge.badgeClass}`}>
                        <span className={`size-1.5 rounded-full ${badge.dotClass}`} />
                        {badge.text}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-neutral-400">{getLokasiPenyimpanan(item.status, item.lokasiPenyimpanan)}</TableCell>
                    {user?.role === "admin" && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-7 w-7 rounded-sm hover:bg-neutral-800 text-neutral-400 cursor-pointer border-neutral-800">
                              <MoreVertical className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-sm bg-neutral-950 border-neutral-800 text-neutral-200">
                            <DropdownMenuItem className="px-2 h-8 rounded-sm cursor-pointer focus:bg-neutral-800" onClick={() => handleOpenEdit(item)}>
                              <Edit className="size-3.5 mr-1" />
                              <span className="text-xs">Edit Barang</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="px-2 h-8 rounded-sm text-red-400 focus:bg-red-950/50 focus:text-red-400 cursor-pointer" onClick={() => handleDelete(item.id, item.serialNumber)}>
                              <Trash2 className="size-3.5 mr-1" />
                              <span className="text-xs">Hapus Barang</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 px-1 text-xs shrink-0">
        <div className="text-neutral-500">
          Menampilkan <span className="font-medium text-neutral-200">{barangList.length}</span> dari{" "}
          <span className="font-medium text-neutral-200">{totalItems}</span> unit inventaris
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-neutral-500">Baris:</span>
            <Select value={pageSize.toString()} onValueChange={(val) => setPageSize(parseInt(val, 10))}>
              <SelectTrigger className="w-[70px] h-8 text-xs bg-neutral-900 border-neutral-800 text-neutral-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-200">
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="size-8 bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200" disabled={currentPage <= 1} onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}><ChevronLeft className="size-4" /></Button>
            <span className="px-2 text-neutral-400 font-medium">{currentPage} / {totalPages}</span>
            <Button variant="outline" size="icon" className="size-8 bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}><ChevronRight className="size-4" /></Button>
          </div>
        </div>
      </div>

      <BarangDetailDrawer
        isOpen={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        detailBarang={detailBarang}
        userRole={user?.role}
        onOpenEdit={handleOpenEdit}
        getStatusBadgeProps={getStatusBadgeProps}
        formatTanggal={formatTanggal}
        ADMIN_LOCATION={ADMIN_LOCATION}
        getBaseUrl={getBaseUrl}
        getHeaders={getHeaders}
      />

      <BarangFormModal
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        formMode={formMode}
        formData={formData}
        setFormData={setFormData}
        formErrors={formErrors}
        isSaving={isSaving}
        onSubmit={handleSubmitForm}
        categories={categories} 
        availableFormLocations={dbLocations}
        STATUS_OPTIONS={STATUS_OPTIONS}
      />

      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base text-destructive">
              {deleteDialog?.type === "single"
                ? `Hapus Unit ${deleteDialog.serialNumber}`
                : `Hapus ${deleteDialog?.ids.length} Unit Terpilih?`}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Tindakan ini tidak dapat dibatalkan. Unit barang yang dihapus akan terhapus dari sistem inventaris.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel disabled={isDeleting}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              variant="destructive"
            >
              {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : "Ya, Hapus Data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
