"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import {
  Boxes,
  Plus,
  Search,
  MoreVertical,
  Trash2,
  Edit,
  Download,
  ScanLine,
  Loader2,
} from "lucide-react"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from "@/components/ui/drawer"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
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

import { toast } from "sonner"
import { Link, useSearchParams } from "react-router-dom"
import { saveExportFile } from "@/lib/export-file"
import * as XLSX from "xlsx"
import { useAuth } from "@/lib/auth"

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

import type { StatusUnit, BarangUnit, RiwayatUnit, StorageLocationOption } from "@/types/inventory"
import type { Transaction } from "@/types/transaction"
import type { DeleteDialogState } from "@/types/ui"

const STATUS_OPTIONS: StatusUnit[] = ["Tersedia", "Diluar", "Rusak", "Hilang"]
const ADMIN_LOCATION = "KP Tasikmalaya"
const getLokasiPenyimpanan = (
  status: StatusUnit,
  lokasiPenyimpanan: string
) => status === "Diluar" ? "Diluar" : lokasiPenyimpanan.trim()

function EmptyBarangTableState({
  isFiltered,
}: {
  isFiltered: boolean
}) {
  return (
    <div className="flex min-h-75 items-center justify-center px-6 py-12">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
          {isFiltered ? (
            <Search className="size-7" strokeWidth={1.8} />
          ) : (
            <Boxes className="size-7" strokeWidth={1.8} />
          )}
        </div>
        <div className="space-y-1.5">
          <p className="text-base font-semibold text-foreground">
            {isFiltered ? "Tidak ada unit yang cocok" : "Belum ada data barang"}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isFiltered
              ? "Coba ubah kata kunci pencarian atau status filter yang sedang aktif."
              : "Data unit akan tampil di sini setelah barang masuk didaftarkan ke sistem."}
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Komponen DataBarangPage
 * 
 * Modul utama untuk melihat, menyaring (filter), mengedit, dan mengekspor seluruh data Inventaris.
 * Bertindak sebagai "Source of Truth" visual untuk Master Data Items.
 * 
 * @returns {JSX.Element} Antarmuka halaman master data barang.
 */
export default function DataBarangPage() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [barangList, setBarangList] = useState<BarangUnit[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [searchParams] = useSearchParams()
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "")
  useEffect(() => {
    const search = searchParams.get("search")
    if (search) {
      setSearchTerm(search)
    }
  }, [searchParams])
  const [dbCategories, setDbCategories] = useState<string[]>([])
  const [dbLocations, setDbLocations] = useState<StorageLocationOption[]>([])

  /**
   * Fungsi sentral untuk mengambil seluruh data pendukung (Items, Transactions, Categories, Locations).
   * Dilengkapi dengan mekanisme 'Legacy Migration' untuk memperbaiki konsistensi data lama.
   */
  const loadData = async () => {
    try {
      const resItems = await fetch(`${getBaseUrl()}/items`, { method: "GET", headers: getHeaders() })
      if (!resItems.ok) throw new Error("Gagal mengambil data barang")
      const rawItems = await resItems.json()
      const data: BarangUnit[] = rawItems.data || rawItems

      // Terapkan filter Role-Based Access Control untuk mitra.
      // Strategi ganda: cocokkan berdasarkan field `mitra` ATAU berdasarkan lokasi penyimpanan milik mitra.
      // Ini lebih robust karena tidak bergantung pada kecocokan string nama yang rawan inkonsistensi.

      // Fetch lokasi dulu (dipakai untuk filter mitra & populate dbLocations)
      const resLoc = await fetch(`${getBaseUrl()}/locations`, { method: "GET", headers: getHeaders() })
      const rawLoc = await resLoc.json()
      const locationsData: any[] = rawLoc.data || rawLoc

      let visibleData: BarangUnit[]
      if (user?.role === "mitra") {
        // Kumpulkan semua nama lokasi yang dimiliki mitra dari endpoint /locations
        const mitraLocationNames = new Set<string>()
        locationsData.forEach((loc: any) => {
          const locOwner = (loc.owner || "").trim().toLowerCase()
          const isMitraOwned =
            locOwner === user.displayName.trim().toLowerCase() ||
            locOwner === user.username.trim().toLowerCase() ||
            (user.identityCode && locOwner.includes(user.identityCode.trim().toLowerCase()))
          if (!isMitraOwned) return
          if (loc.type === "Rak" && loc.levels) {
            loc.levels.forEach((lvl: any) => mitraLocationNames.add(`${loc.name} - ${lvl.name}`.trim().toLowerCase()))
          } else {
            mitraLocationNames.add((loc.name || "").trim().toLowerCase())
          }
        })

        visibleData = data.filter((item) => {
          // Cocokkan via field mitra
          if (item.mitra) {
            const itemMitra = item.mitra.trim().toLowerCase()
            if (
              itemMitra === user.displayName.trim().toLowerCase() ||
              itemMitra === user.username.trim().toLowerCase() ||
              (user.identityCode && itemMitra.includes(user.identityCode.trim().toLowerCase()))
            ) return true
          }
          // Cocokkan via lokasi penyimpanan milik mitra
          if (item.lokasiPenyimpanan) {
            const itemLokasi = item.lokasiPenyimpanan.trim().toLowerCase()
            if (mitraLocationNames.has(itemLokasi)) return true
          }
          return false
        })
      } else {
        visibleData = data
      }
          
      // Normalisasi nama mitra (khusus admin)
      const normalizedData = visibleData.map((item) => ({
        ...item,
        mitra: !item.mitra || item.mitra === "KP" || item.mitra === "Administrator Utama" || item.mitra === "admin" ? ADMIN_LOCATION : item.mitra,
        lokasiPenyimpanan: getLokasiPenyimpanan(
          item.status,
          item.lokasiPenyimpanan || ""
        ),
      }))
      setBarangList(normalizedData)

      // Backward Compatibility: Update item lama yang berstatus "Diluar" namun lokasinya bukan "Diluar"
      const legacyExitedItems = visibleData.filter(
        (item) =>
          item.status === "Diluar" &&
          item.lokasiPenyimpanan?.trim() !== "Diluar"
      )

      if (legacyExitedItems.length > 0) {
        const updateResults = await Promise.allSettled(
          legacyExitedItems.map((item) =>
            fetch(`${getBaseUrl()}/items/${item.id}`, {
              method: "PUT",
              headers: getHeaders(),
              body: JSON.stringify({
                ...item,
                lokasiPenyimpanan: "Diluar",
              }),
            })
          )
        )

        if (updateResults.some((result) => result.status === "rejected")) {
          console.warn("Sebagian lokasi barang keluar gagal diperbarui ke database.")
        }
      }

      // Ambil Riwayat Transaksi (Untuk sidebar Detail Item)
      const resTrx = await fetch(`${getBaseUrl()}/transactions`, { method: "GET", headers: getHeaders() })
      const rawTrx = await resTrx.json()
      const transactionData: Transaction[] = rawTrx.data || rawTrx

      setTransactions(
        user?.role === "mitra"
          ? transactionData.filter((transaction) => {
              if (!transaction.mitra) return false
              const trxMitra = transaction.mitra.trim().toLowerCase()
              return (
                trxMitra === user.displayName.trim().toLowerCase() ||
                trxMitra === user.username.trim().toLowerCase() ||
                (user.identityCode &&
                  trxMitra.includes(user.identityCode.trim().toLowerCase()))
              )
            })
          : transactionData
      )

      // Ambil Kategori untuk filter & form
      const resCat = await fetch(`${getBaseUrl()}/categories`, { method: "GET", headers: getHeaders() })
      const rawCat = await resCat.json()
      const categoriesList = rawCat.data || rawCat
      const categories = (Array.isArray(categoriesList) ? categoriesList : []).map((c: any) => ({
        ...c,
        name: c.nama || c.name || "",
        safetyStock: c.safetyStock !== undefined ? c.safetyStock : (c.safety_stock || 5),
      }))

      setDbCategories(categories.map(c => c.name))

      // Populate dbLocations dari locationsData yang sudah di-fetch di atas
      const locs: StorageLocationOption[] = []
      locationsData.forEach((loc: any) => {
        const owner = loc.owner || ADMIN_LOCATION
        if (loc.type === "Rak" && loc.levels) {
          loc.levels.forEach((lvl: any) =>
            locs.push({
              name: `${loc.name} - ${lvl.name}`,
              owner,
            })
          )
        } else {
          locs.push({
            name: loc.name,
            owner,
          })
        }
      })
      setDbLocations(locs)
    } catch (error) {
      console.error("Failed to fetch data:", error)
      toast.error("Gagal memuat data dari server.")
    }
  }

  useEffect(() => {
    loadData()
  }, [user])
  const [filterStatus, setFilterStatus] = useState("all")
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<"add" | "edit">("add")
  const [selectedBarang, setSelectedBarang] = useState<BarangUnit | null>(null)
  const [formData, setFormData] = useState({
    serialNumber: "",
    kategori: "",
    merek: "",
    status: "Tersedia" as StatusUnit,
    lokasiPenyimpanan: "",
    tanggalMasuk: "",
    tanggalKeluar: "",
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const isDetailOpenRef = useRef(false)
  const [detailBarang, setDetailBarang] = useState<BarangUnit | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const formLocationOwner =
    user?.role === "mitra"
      ? user.displayName
      : formMode === "edit"
        ? selectedBarang?.mitra || ADMIN_LOCATION
        : ADMIN_LOCATION
  const availableFormLocations = dbLocations.filter((location) => {
    if (user?.role === "mitra") {
      const locOwner = location.owner.trim().toLowerCase()
      return (
        locOwner === user.displayName.trim().toLowerCase() ||
        locOwner === user.username.trim().toLowerCase() ||
        (user.identityCode && locOwner.includes(user.identityCode.trim().toLowerCase()))
      )
    }
    return location.owner.trim().toLowerCase() === formLocationOwner.trim().toLowerCase()
  })

  const resetForm = () => {
    setFormData({
      serialNumber: "",
      kategori: "",
      merek: "",
      status: "Tersedia",
      lokasiPenyimpanan: "",
      tanggalMasuk: new Date().toISOString().slice(0, 10),
      tanggalKeluar: "",
    })
    setFormErrors({})
    setSelectedBarang(null)
  }

  const handleOpenEdit = (barang: BarangUnit) => {
    setFormMode("edit")
    setSelectedBarang(barang)
    setFormData({
      serialNumber: barang.serialNumber,
      kategori: barang.kategori,
      merek: barang.merek,
      status: barang.status,
      lokasiPenyimpanan: getLokasiPenyimpanan(
        barang.status,
        barang.lokasiPenyimpanan
      ),
      tanggalMasuk: barang.tanggalMasuk,
      tanggalKeluar: barang.tanggalKeluar || "",
    })
    setFormErrors({})
    setIsFormOpen(true)
  }

  const handleOpenDetail = (barang: BarangUnit) => {
    if (isDetailOpenRef.current) return;
    isDetailOpenRef.current = true;
    setDetailBarang(barang)
    setIsDetailOpen(true)
  }

  const handleDetailOpenChange = (open: boolean) => {
    isDetailOpenRef.current = open;
    setIsDetailOpen(open);
  }

  const handleDelete = async (id: string) => {
    const barang = barangList.find(b => b.id === id)
    if (!barang) return
    setDeleteDialog({
      type: "single",
      ids: [id],
      serialNumber: barang.serialNumber,
    })
  }

  const confirmDelete = async () => {
    if (!deleteDialog || isDeleting) return
    const idsToDelete = deleteDialog.ids
    setIsDeleting(true)

    try {
      for (const id of idsToDelete) {
        await fetch(`${getBaseUrl()}/items/${id}`, {
          method: "DELETE",
          headers: getHeaders(),
        })
      }

      setBarangList(prev => prev.filter(b => !idsToDelete.includes(b.id)))
      setSelectedIds(prev => prev.filter(selectedId => !idsToDelete.includes(selectedId)))
      setDeleteDialog(null)

      if (deleteDialog.type === "single") {
        toast.success(`Unit dengan SN ${deleteDialog.serialNumber} berhasil dihapus dari sistem.`)
      } else {
        toast.success(`${idsToDelete.length} unit berhasil dihapus dari sistem.`)
      }
    } catch (error) {
      toast.error(deleteDialog.type === "single" ? "Gagal menghapus unit." : "Gagal menghapus beberapa unit.")
    } finally {
      setIsDeleting(false)
    }
  }

  const buildRusakTransaction = async (
    barang: BarangUnit,
    lokasiAsal: string
  ): Promise<Transaction> => {
    const transactionDate = new Date().toISOString().slice(0, 10)
    const dateCode = transactionDate.replace(/-/g, "")
    const prefix = `DMG-${dateCode}-`
    const resTrx = await fetch(`${getBaseUrl()}/transactions`, { method: "GET", headers: getHeaders() })
    const rawTrx = await resTrx.json()
    const latestTransactions: Transaction[] = rawTrx.data || rawTrx
    let maxSequence = 0

    latestTransactions.forEach((transaction) => {
      if (!transaction.nomor.startsWith(prefix)) return

      const sequence = Number.parseInt(transaction.nomor.slice(prefix.length), 10)
      if (!Number.isNaN(sequence) && sequence > maxSequence) {
        maxSequence = sequence
      }
    })

    return {
      id: `TRX-DMG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tanggal: transactionDate,
      nomor: `${prefix}${String(maxSequence + 1).padStart(4, "0")}`,
      kategori: "Rusak",
      status: "Selesai",
      sn: barang.serialNumber,
      merek: barang.merek,
      asal: lokasiAsal || barang.lokasiPenyimpanan,
      tujuan: barang.lokasiPenyimpanan,
      mitra:
        user?.role === "mitra"
          ? user.displayName
          : barang.mitra,
      keterangan: "Status barang diubah menjadi Rusak",
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSaving) return
    const errors: Record<string, string> = {}
    const lokasiPenyimpanan = getLokasiPenyimpanan(
      formData.status,
      formData.lokasiPenyimpanan
    )
    if (!formData.serialNumber.trim()) errors.serialNumber = "Serial number wajib diisi"
    if (!formData.kategori.trim()) errors.kategori = "Kategori wajib diisi"
    if (!formData.merek.trim()) errors.merek = "Merek barang wajib diisi"
    if (!lokasiPenyimpanan) errors.lokasiPenyimpanan = "Lokasi penyimpanan wajib diisi"
    if (!formData.tanggalMasuk.trim()) errors.tanggalMasuk = "Tanggal masuk wajib diisi"
    const isDuplicateSN = barangList.some(b => b.serialNumber.trim().toLowerCase() === formData.serialNumber.trim().toLowerCase() && (formMode === "add" || b.id !== selectedBarang?.id))
    if (isDuplicateSN) errors.serialNumber = "Serial number sudah terdaftar di sistem"

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      toast.error("Gagal menyimpan. Silakan periksa kembali form Anda.")
      return
    }

    setIsSaving(true)
    try {
      if (formMode === "add") {
        const newBarang: BarangUnit = {
          id: crypto.randomUUID(),
          serialNumber: formData.serialNumber.toUpperCase(),
          kategori: formData.kategori,
          merek: formData.merek,
          status: formData.status,
          lokasiPenyimpanan,
          tanggalMasuk: formData.tanggalMasuk,
          tanggalKeluar: formData.tanggalKeluar || undefined,
          mitra:
            user?.role === "mitra"
              ? user.displayName
              : ADMIN_LOCATION,
        }
        try {
          const resAdd = await fetch(`${getBaseUrl()}/items`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(newBarang),
          })
          if (!resAdd.ok) {
            const err = await resAdd.json().catch(() => ({}))
            throw new Error(err.message || "Gagal menyimpan unit.")
          }

          if (newBarang.status === "Rusak") {
            let rusakTransaction: Transaction | null = null

            try {
              rusakTransaction = await buildRusakTransaction(
                newBarang,
                newBarang.lokasiPenyimpanan
              )
              const resTrx = await fetch(`${getBaseUrl()}/transactions`, {
                method: "POST",
                headers: getHeaders(),
                body: JSON.stringify(rusakTransaction),
              })
              if (!resTrx.ok) throw new Error("Gagal mencatat transaksi rusak")
              if (rusakTransaction) {
                const savedTransaction = rusakTransaction
                setTransactions(prev => [savedTransaction, ...prev])
              }
            } catch (transactionError) {
              if (rusakTransaction) {
                await fetch(`${getBaseUrl()}/transactions/${rusakTransaction.id}`, { method: "DELETE", headers: getHeaders() }).catch(() => undefined)
              }
              await fetch(`${getBaseUrl()}/items/${newBarang.id}`, { method: "DELETE", headers: getHeaders() })
              throw transactionError
            }
          }

          setBarangList(prev => [newBarang, ...prev])
          toast.success(`Unit baru dengan SN ${newBarang.serialNumber} berhasil didaftarkan!`)
        } catch (error: any) {
          toast.error(error.message || "Gagal menyimpan unit.")
          return
        }
      } else {
        const originalBarang = selectedBarang!
        const updatedBarang = {
          ...originalBarang,
          serialNumber: formData.serialNumber.toUpperCase(),
          kategori: formData.kategori,
          merek: formData.merek,
          status: formData.status,
          lokasiPenyimpanan,
          tanggalMasuk: formData.tanggalMasuk,
          tanggalKeluar: formData.tanggalKeluar || undefined,
          mitra:
            user?.role === "mitra"
              ? user.displayName
              : !originalBarang.mitra || originalBarang.mitra === "KP" || originalBarang.mitra === "Administrator Utama" || originalBarang.mitra === "admin" ? ADMIN_LOCATION : originalBarang.mitra,
        }
        const changedToRusak =
          originalBarang.status !== "Rusak" && updatedBarang.status === "Rusak"

        try {
          const resUpdate = await fetch(`${getBaseUrl()}/items/${updatedBarang.id}`, {
            method: "PUT",
            headers: getHeaders(),
            body: JSON.stringify(updatedBarang),
          })
          if (!resUpdate.ok) {
            const err = await resUpdate.json().catch(() => ({}))
            throw new Error(err.message || "Gagal memperbarui unit.")
          }

          if (changedToRusak) {
            let rusakTransaction: Transaction | null = null

            try {
              rusakTransaction = await buildRusakTransaction(
                updatedBarang,
                originalBarang.lokasiPenyimpanan
              )
              const resTrx = await fetch(`${getBaseUrl()}/transactions`, {
                method: "POST",
                headers: getHeaders(),
                body: JSON.stringify(rusakTransaction),
              })
              if (!resTrx.ok) throw new Error("Gagal mencatat transaksi rusak")
              if (rusakTransaction) {
                const savedTransaction = rusakTransaction
                setTransactions(prev => [savedTransaction, ...prev])
              }
            } catch (transactionError) {
              if (rusakTransaction) {
                await fetch(`${getBaseUrl()}/transactions/${rusakTransaction.id}`, { method: "DELETE", headers: getHeaders() }).catch(() => undefined)
              }
              await fetch(`${getBaseUrl()}/items/${originalBarang.id}`, {
                method: "PUT",
                headers: getHeaders(),
                body: JSON.stringify(originalBarang),
              })
              throw transactionError
            }
          }

          setBarangList(prev => prev.map(b => b.id === originalBarang.id ? updatedBarang : b))
          toast.success(
            changedToRusak
              ? `Unit dengan SN ${updatedBarang.serialNumber} ditandai Rusak dan dicatat ke riwayat.`
              : `Unit dengan SN ${updatedBarang.serialNumber} berhasil diperbarui!`
          )
        } catch (error: any) {
          console.error("Gagal memperbarui unit:", error)
          toast.error(
            error.message || (changedToRusak
              ? "Gagal menyimpan status Rusak ke data barang dan riwayat."
              : "Gagal memperbarui unit.")
          )
          return
        }
      }

      setIsFormOpen(false)
      resetForm()
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Menggabungkan filter teks dan status dropdown. Di-memoize untuk performa tabel.
   */
  const filteredBarang = useMemo(() => {
    return barangList.filter(b => {
      const matchesSearch =
        b.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.kategori.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.merek.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.lokasiPenyimpanan.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.mitra?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = filterStatus === "all" || b.status === filterStatus
      return matchesSearch && matchesStatus
    })
  }, [barangList, searchTerm, filterStatus])

  const hasActiveFilter = searchTerm.trim().length > 0 || filterStatus !== "all"
  const totalPages = Math.max(1, Math.ceil(filteredBarang.length / pageSize))
  const paginatedBarang = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredBarang.slice(startIndex, startIndex + pageSize)
  }, [currentPage, filteredBarang, pageSize])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterStatus, pageSize])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [
        ...new Set([...prev, ...paginatedBarang.map(b => b.id)])
      ])
    } else {
      const pageIds = new Set(paginatedBarang.map(b => b.id))
      setSelectedIds(prev => prev.filter(id => !pageIds.has(id)))
    }
  }

  const handleSelectRow = (checked: boolean, id: string) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id])
    } else {
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    setDeleteDialog({
      type: "bulk",
      ids: selectedIds,
    })
  }

  const getStatusBadgeProps = (status: StatusUnit) => {
    switch (status) {
      case "Tersedia":
        return { text: "Tersedia", dotClass: "bg-emerald-500" }
      case "Diluar":
        return { text: "Diluar", dotClass: "bg-sky-500" }
      case "Rusak":
        return { text: "Rusak", dotClass: "bg-rose-500" }
      case "Hilang":
      default:
        return { text: "Hilang", dotClass: "bg-amber-500" }
    }
  }

  const formatTanggal = (tgl: string) => {
    if (!tgl) return "-"
    const date = new Date(tgl)
    if (isNaN(date.getTime())) return tgl
    return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
  }

  /**
   * Mengekspor data tabel yang saat ini ditampilkan ke format Excel (.xlsx).
   * Memanfaatkan pustaka 'xlsx' dan utilitas saveExportFile.
   */
  const handleExportExcel = async () => {
    if (filteredBarang.length === 0) {
      toast.error("Tidak ada data barang yang dapat diekspor.")
      return
    }

    try {
      const headers = [
        "No",
        "Serial Number",
        "Merek",
        "Kategori",
        "Status",
        "Lokasi Penyimpanan",
        "Tempat",
        "Tanggal Masuk",
        "Tanggal Keluar",
      ]

      const rows = filteredBarang.map((item, index) => {
        return [
          index + 1,
          item.serialNumber,
          item.merek,
          item.kategori,
          item.status,
          item.lokasiPenyimpanan,
          item.mitra || "KP Tasikmalaya",
          item.tanggalMasuk,
          item.tanggalKeluar || "",
        ]
      })

      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Data Barang")
      const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })

      const now = new Date()
      const dateSuffix = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
      ].join("-")
      const exportResult = await saveExportFile({
        fileName: `data-barang-${dateSuffix}.xlsx`,
        contents: buffer,
      })

      if (!exportResult.saved) return

      toast.success(
        `${filteredBarang.length} data barang berhasil diekspor untuk Excel.`,
        exportResult.path
          ? { description: `Disimpan di: ${exportResult.path}` }
          : undefined
      )
    } catch (error) {
      console.error("Gagal mengekspor data barang:", error)
      toast.error("Gagal memproses ekspor data barang.")
    }
  }

  /**
   * Menyaring seluruh riwayat transaksi (dari tabel 'transactions')
   * yang memiliki SN (Serial Number) sama persis dengan barang yang
   * sedang dibuka di panel Detail (Drawer/Sheet).
   * Data diurutkan dari yang terbaru (descending).
   */
  const recentRiwayat = useMemo<RiwayatUnit[]>(() => {
    if (!detailBarang) return []

    return transactions
      .filter((transaction) => transaction.sn.toLowerCase() === detailBarang.serialNumber.toLowerCase())
      .sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.tanggal).getTime();
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.tanggal).getTime();
        return timeB - timeA; // terbaru di atas, terlama di bawah
      })
      .map<RiwayatUnit>((transaction) => ({
        tanggal: transaction.tanggal,
        tipe: transaction.kategori,
        nomorSurat: transaction.nomor,
        dariStatus: transaction.asal || "-",
        keStatus: transaction.tujuan || "-",
        lokasi: transaction.tujuan || transaction.asal || detailBarang.lokasiPenyimpanan,
        catatan: transaction.keterangan || undefined,
      }))
  }, [detailBarang, transactions])

  return (
    <div className="flex min-h-0 flex-col gap-6 overflow-hidden p-4 md:p-6 lg:p-8 animate-fade-in">
      {/* Filter and Search Section */}
      <Card className="shrink-0 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute top-2 left-3 size-4 text-muted-foreground" />
              <Input
                placeholder="Cari SN, merek, lokasi, atau pemilik..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-37.5 py-0">
                  <SelectValue placeholder="Status Unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(searchTerm || filterStatus !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSearchTerm("")
                    setFilterStatus("all")
                  }}
                >
                  Reset Filter
                </Button>
              )}
            </div>

          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            {user?.role === "admin" && selectedIds.length > 0 && (
              <Button variant="outline" onClick={handleBulkDelete}>
                <Trash2 className="size-4 mr-2" />
                Hapus ({selectedIds.length})
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleExportExcel}
              disabled={filteredBarang.length === 0}
            >
              <Download className="size-4" />
              <span>Export Excel</span>
            </Button>
            {user?.role === "admin" && (
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md transition-all active:scale-[0.98]"
              >
                <Link to="/barang-masuk" className="flex flex-row items-center">
                  <Plus className="size-4" />
                  <span>Tambah Unit Baru</span>
                </Link>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Data Table */}
      <div className="min-h-0 flex-1 rounded-lg border bg-card/20 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            <TableRow>
              <TableHead className="w-12.5 text-center">No.</TableHead>
              {user?.role === "admin" && (
                <TableHead className="w-12.5 text-center">
                  <Checkbox
                    checked={
                      paginatedBarang.length > 0 &&
                      paginatedBarang.every(item => selectedIds.includes(item.id))
                    }
                    onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                    aria-label="Pilih semua"
                  />
                </TableHead>
              )}
              <TableHead className="w-42.5">Serial Number (SN)</TableHead>
              <TableHead className="w-35">Merek</TableHead>
              <TableHead className="w-35">Kategori</TableHead>
              <TableHead className="text-center w-30">Status</TableHead>
              <TableHead>Lokasi Penyimpanan</TableHead>
              {user?.role === "admin" && (
                <TableHead className="w-37.5">Tempat</TableHead>
              )}
              <TableHead className="hidden md:table-cell w-32.5">Tanggal Masuk</TableHead>
              <TableHead className="hidden lg:table-cell w-32.5">Tanggal Keluar</TableHead>
              {user?.role === "admin" && (
                <TableHead className="w-15 text-right"></TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedBarang.length > 0 ? (
              paginatedBarang.map((item, index) => {
                const badge = getStatusBadgeProps(item.status)
                return (
                  <TableRow
                    key={item.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => handleOpenDetail(item)}
                    data-state={selectedIds.includes(item.id) ? "selected" : undefined}
                  >
                    <TableCell className="text-center font-medium">
                      {(currentPage - 1) * pageSize + index + 1}
                    </TableCell>
                    {user?.role === "admin" && (
                      <TableCell onClick={(e) => e.stopPropagation()} className="text-center">
                        <Checkbox
                          checked={selectedIds.includes(item.id)}
                          onCheckedChange={(checked) => handleSelectRow(checked as boolean, item.id)}
                          aria-label={`Pilih ${item.serialNumber}`}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      {item.serialNumber}
                    </TableCell>
                    <TableCell>
                      {item.merek}
                    </TableCell>
                    <TableCell>
                      {item.kategori}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-normal gap-1.5 px-2.5 py-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                        {badge.text}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.lokasiPenyimpanan}
                    </TableCell>
                    {user?.role === "admin" && (
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="font-normal"
                        >
                          {item.mitra || ADMIN_LOCATION}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell className="hidden md:table-cell">
                      {formatTanggal(item.tanggalMasuk)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {formatTanggal(item.tanggalKeluar || "")}
                    </TableCell>
                    {user?.role === "admin" && (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon-xs" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                              <MoreVertical className="size-4" />
                              <span className="sr-only">Menu Aksi</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[160px]">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenEdit(item) }}>
                              <Edit className="size-4 mr-2" />
                              <span>Edit Unit</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }}
                              className="text-destructive hover:bg-destructive/10 dark:text-destructive/80"
                            >
                              <Trash2 className="size-4 mr-2" />
                              <span>Hapus</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={user?.role === "admin" ? 12 : 9} className="p-0">
                  <EmptyBarangTableState isFiltered={hasActiveFilter} />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {filteredBarang.length > 0 && (
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Baris per halaman</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => setPageSize(Number(value))}
            >
              <SelectTrigger className="h-8 w-[72px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <span className="text-sm text-muted-foreground">
              Halaman {currentPage} dari {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                disabled={currentPage === 1}
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Drawer Form */}
      <Drawer open={isFormOpen} onOpenChange={setIsFormOpen} direction={isMobile ? "bottom" : "right"}>
        <DrawerContent>
          <DrawerHeader className="gap-1">
            <DrawerTitle>
              {formMode === "add" ? "Registrasi Unit Baru" : "Edit Informasi Unit"}
            </DrawerTitle>
            <DrawerDescription>
              Isi data detail berikut untuk mendaftarkan atau memutakhirkan unit barang berdasarkan serial number di sistem gudang.
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

              {/* Serial Number */}
              <div className="flex flex-col gap-3">
                <Label htmlFor="serialNumber">Serial Number (SN)</Label>
                <div className="relative">
                  <ScanLine className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
                  <Input
                    id="serialNumber"
                    placeholder="Scan atau ketik serial number..."
                    value={formData.serialNumber}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, serialNumber: e.target.value }))
                      if (formErrors.serialNumber) {
                        setFormErrors(prev => { const next = { ...prev }; delete next.serialNumber; return next })
                      }
                    }}
                    className={`pl-9 ${formErrors.serialNumber ? "border-destructive" : ""}`}
                  />
                </div>
                {formErrors.serialNumber && (
                  <p className="text-[11px] text-destructive font-medium">{formErrors.serialNumber}</p>
                )}
              </div>

              {/* Kategori */}
              <div className="flex flex-col gap-3">
                <Label htmlFor="kategori">Kategori</Label>
                <Select
                  value={formData.kategori}
                  onValueChange={(val) => {
                    setFormData(prev => ({ ...prev, kategori: val }))
                    if (formErrors.kategori) {
                      setFormErrors(prev => { const next = { ...prev }; delete next.kategori; return next })
                    }
                  }}
                >
                  <SelectTrigger id="kategori" className={formErrors.kategori ? "border-destructive" : ""}>
                    <SelectValue placeholder="Pilih kategori..." />
                  </SelectTrigger>
                  <SelectContent>
                    {dbCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.kategori && (
                  <p className="text-[11px] text-destructive font-medium">{formErrors.kategori}</p>
                )}
              </div>

              {/* Merek */}
              <div className="flex flex-col gap-3">
                <Label htmlFor="merek">Merek</Label>
                <Input
                  id="merek"
                  placeholder="MikroTik, Dell, Cisco..."
                  value={formData.merek}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, merek: e.target.value }))
                    if (formErrors.merek) {
                      setFormErrors(prev => { const next = { ...prev }; delete next.merek; return next })
                    }
                  }}
                  className={formErrors.merek ? "border-destructive" : ""}
                />
                {formErrors.merek && (
                  <p className="text-[11px] text-destructive font-medium">{formErrors.merek}</p>
                )}
              </div>

              {/* Status & Tanggal Masuk */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-3">
                  <Label htmlFor="status">Status Unit</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(val) => {
                      const status = val as StatusUnit
                      setFormData(prev => ({
                        ...prev,
                        status,
                        lokasiPenyimpanan:
                          status === "Diluar"
                            ? "Diluar"
                            : prev.lokasiPenyimpanan === "Diluar"
                              ? ""
                              : prev.lokasiPenyimpanan,
                      }))
                      if (status === "Diluar" && formErrors.lokasiPenyimpanan) {
                        setFormErrors(prev => {
                          const next = { ...prev }
                          delete next.lokasiPenyimpanan
                          return next
                        })
                      }
                    }}
                  >
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Pilih status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-3">
                  <Label htmlFor="tanggalMasuk">Tanggal Masuk</Label>
                  <Input
                    id="tanggalMasuk"
                    type="date"
                    value={formData.tanggalMasuk}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, tanggalMasuk: e.target.value }))
                      if (formErrors.tanggalMasuk) {
                        setFormErrors(prev => { const next = { ...prev }; delete next.tanggalMasuk; return next })
                      }
                    }}
                    className={formErrors.tanggalMasuk ? "border-destructive" : ""}
                  />
                  {formErrors.tanggalMasuk && (
                    <p className="text-[11px] text-destructive font-medium">{formErrors.tanggalMasuk}</p>
                  )}
                </div>
              </div>

              {/* Lokasi Penyimpanan & Tanggal Keluar */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-3">
                  <Label htmlFor="lokasiPenyimpanan">Lokasi Penyimpanan</Label>
                  <Select
                    value={formData.lokasiPenyimpanan}
                    disabled={formData.status === "Diluar"}
                    onValueChange={(val) => {
                      setFormData(prev => ({ ...prev, lokasiPenyimpanan: val }))
                      if (formErrors.lokasiPenyimpanan) {
                        setFormErrors(prev => { const next = { ...prev }; delete next.lokasiPenyimpanan; return next })
                      }
                    }}
                  >
                    <SelectTrigger id="lokasiPenyimpanan">
                      <SelectValue placeholder="Pilih lokasi penyimpanan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {formData.status === "Diluar" && (
                        <SelectItem value="Diluar">Diluar</SelectItem>
                      )}
                      {availableFormLocations.map((loc) => (
                        <SelectItem key={`${loc.owner}-${loc.name}`} value={loc.name}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.lokasiPenyimpanan && (
                    <p className="text-[11px] text-destructive font-medium">{formErrors.lokasiPenyimpanan}</p>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <Label htmlFor="tanggalKeluar">Tanggal Keluar</Label>
                  <Input
                    id="tanggalKeluar"
                    type="date"
                    value={formData.tanggalKeluar || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, tanggalKeluar: e.target.value }))}
                  />
                </div>
              </div>
              <DrawerFooter>
                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground font-semibold"
                  disabled={isSaving}
                >
                  {isSaving ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
                  Simpan Unit
                </Button>
                <DrawerClose asChild>
                  <Button variant="outline" className="w-full" disabled={isSaving}>
                    Batal
                  </Button>
                </DrawerClose>
              </DrawerFooter>
            </form>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Detail Drawer */}
      <Drawer open={isDetailOpen} onOpenChange={handleDetailOpenChange} direction={isMobile ? "bottom" : "right"}>
        <DrawerContent>
          {detailBarang && (
            <>
              <DrawerHeader className="gap-1">
                <DrawerTitle>{detailBarang.serialNumber}</DrawerTitle>
                <DrawerDescription>
                  Detail identitas unit dan rantai histori pergerakan
                </DrawerDescription>
              </DrawerHeader>

              <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
                {/* Metadata */}
                <form className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-3">
                      <Label>Merek</Label>
                      <Input readOnly defaultValue={detailBarang.merek} />
                    </div>
                    <div className="flex flex-col gap-3">
                      <Label>Kategori</Label>
                      <Input readOnly defaultValue={detailBarang.kategori} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <Label>Status Gudang</Label>
                    <Input readOnly defaultValue={getStatusBadgeProps(detailBarang.status).text} />
                  </div>

                  <div className="flex flex-col gap-3">
                    <Label>Lokasi Aktif</Label>
                    <Input readOnly defaultValue={detailBarang.lokasiPenyimpanan} />
                  </div>

                  {user?.role === "admin" && (
                    <div className="flex flex-col gap-3">
                      <Label>Pemilik</Label>
                      <Input
                        readOnly
                        defaultValue={detailBarang.mitra || ADMIN_LOCATION}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-3">
                      <Label>Tanggal Masuk</Label>
                      <Input readOnly defaultValue={detailBarang.tanggalMasuk} />
                    </div>
                    <div className="flex flex-col gap-3">
                      <Label>Tanggal Keluar</Label>
                      <Input readOnly defaultValue={formatTanggal(detailBarang.tanggalKeluar || "")} />
                    </div>
                  </div>
                </form>

                {/* Ledger Timeline */}
                <div className="flex flex-col gap-4 pt-2">
                  <div className="flex gap-2 leading-none font-medium">
                    Rantai Histori Pergerakan
                  </div>
                  <div>
                    {recentRiwayat.length > 0 ? (
                      <div className="space-y-0">
                        {recentRiwayat.map((riw, idx) => (
                          <div key={idx} className="flex gap-4">
                            <div className="flex flex-col items-center">
                              <div className="w-2.5 h-2.5 shrink-0 rounded-full bg-border border-2 border-muted-foreground mt-1.5" />
                              {idx < recentRiwayat.length - 1 && (
                                <div className="w-px h-full bg-border my-1" />
                              )}
                            </div>
                            <div className="flex-1 pb-6 last:pb-1">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                                <span className="font-medium text-foreground">{riw.tipe}</span>
                                <span className="text-xs text-muted-foreground">{riw.tanggal}</span>
                              </div>
                              <div className="text-muted-foreground mb-2.5">
                                {riw.nomorSurat}
                              </div>
                              <div className="bg-muted/40 rounded-lg p-3 text-xs border border-border/50">
                                <div className="flex items-center gap-2 mb-1.5 text-muted-foreground">
                                  <span>{riw.dariStatus}</span>
                                  <span>&rarr;</span>
                                  <span className="font-medium text-foreground">{riw.keStatus}</span>
                                </div>
                                <div className="text-muted-foreground">
                                  Loc: <span className="font-medium text-foreground">{riw.lokasi}</span>
                                </div>
                              </div>
                              {riw.catatan && (
                                <p className="text-xs italic text-muted-foreground mt-2.5">
                                  {riw.catatan}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-xs text-muted-foreground border-2 border-dashed border-border rounded-xl">
                        Belum ada riwayat aktivitas tercatat.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <DrawerFooter>
                <DrawerClose asChild>
                  <Button variant="outline" className="w-full">Tutup</Button>
                </DrawerClose>
              </DrawerFooter>
            </>
          )}
        </DrawerContent>
      </Drawer>

      <AlertDialog open={deleteDialog !== null} onOpenChange={(open) => !open && !isDeleting && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteDialog?.type === "bulk" ? "Hapus beberapa unit?" : "Hapus unit ini?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.type === "bulk"
                ? `${deleteDialog.ids.length} unit akan dihapus dari sistem. Semua transaksi yang terkait dengan serial number unit tersebut juga akan ikut dihapus.`
                : `Unit dengan SN ${deleteDialog?.serialNumber} akan dihapus dari sistem. Semua transaksi terkait serial number ini juga akan ikut dihapus.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}
