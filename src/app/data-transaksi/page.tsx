import { useState, useEffect } from "react"
import { DataTable } from "@/features/transactions/components/transaction-table"
import { Card } from "@/components/ui/card"
import { Download, Plus, Search, Trash2, Loader2, AreaChart, Filter, EllipsisVertical, FileUp, FileDown, ListFilter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Link, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { saveExportFile } from "@/lib/export-file"
import * as XLSX from "xlsx"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { useAuth } from "@/lib/auth"
import type { Transaction } from "@/types/transaction"
import type { DeleteDialogState } from "@/types/ui"
import requestsData from "@/data/request.json"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@/components/ui/drawer"
import { useIsMobile } from "@/hooks/use-mobile"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { IconLayoutColumns, IconChevronDown } from "@tabler/icons-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { DashboardRequest } from "@/types/transaction"
import { cn } from "@/lib/utils"

const getBaseUrl = () => {
  const baseUrl = import.meta.env.URL || import.meta.env.VITE_URL || "http://172.168.9.139:3000/";
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
};

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

const KATEGORI_OPTIONS = ["Masuk", "Keluar", "Rusak"]

/**
 * Komponen DataTransaksiPage
 * 
 * Halaman untuk melihat log riwayat seluruh transaksi barang (Masuk, Keluar, Rusak, Hilang).
 * Menyediakan fungsi filtering canggih, bulk delete, dan eksport data ke Excel.
 *
 * @returns {JSX.Element} Antarmuka halaman riwayat transaksi.
 */
export default function DataTransaksiPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get("tab") || "Menunggu"

  const handleTabChange = (value: string) => {
    setSearchParams((prev) => {
      prev.set("tab", value)
      return prev
    }, { replace: true })
  }

  const [searchTerm, setSearchTerm] = useState("")
  const [filterKategori, setFilterKategori] = useState("all")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<DashboardRequest | null>(null)
  const [localRequests, setLocalRequests] = useState<DashboardRequest[]>(requestsData as DashboardRequest[])
  const isMobile = useIsMobile()

  // Ambil semua nilai unik partnerCategory sebagai opsi filter
  const categoryOptions = Array.from(
    new Set((requestsData as DashboardRequest[]).map((r) => r.partnerCategory))
  ).sort()

  // State untuk filter yang sedang aktif (multi-select)
  const [filterCategories, setFilterCategories] = useState<string[]>([])

  const toggleFilterCategory = (category: string) => {
    setFilterCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    )
  }

  const clearFilters = () => setFilterCategories([])

  const handleStatusChange = (id: string, newStatus: string) => {
    setLocalRequests(prev => prev.map(req => {
      if (req.id === id) {
        return { ...req, status: newStatus }
      }
      return req
    }))
    toast.success(`Status transaksi berhasil diubah menjadi ${newStatus}`)
  }

  /**
   * Mengambil seluruh data riwayat transaksi dari backend.
   * Melakukan *client-side filtering* berdasarkan `role` jika user adalah 'mitra'.
   */
  const fetchTransactions = async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/transactions`, {
        method: "GET",
        headers: getHeaders(),
      });
      if (!res.ok) {
        throw new Error("Gagal mengambil data transaksi");
      }
      const rawTrx = await res.json();
      const data: Transaction[] = rawTrx.data || rawTrx;

      // Jika user adalah mitra, sembunyikan transaksi mitra lain
      setTransactions(
        user?.role === "mitra"
          ? data.filter((transaction) => {
              if (!transaction.mitra) return false
              const trxMitra = transaction.mitra.trim().toLowerCase()
              return (
                trxMitra === user.displayName.trim().toLowerCase() ||
                trxMitra === user.username.trim().toLowerCase() ||
                (user.identityCode &&
                  trxMitra.includes(user.identityCode.trim().toLowerCase()))
              )
            })
          : data
      );
    } catch (error) {
      console.error("Gagal mengambil data transaksi:", error);
      toast.error("Gagal memuat data riwayat transaksi.");
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [user])

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    setDeleteDialog({
      type: "bulk",
      ids: selectedIds,
    })
  }

  const handleDeleteRow = async (id: string) => {
    const transaction = transactions.find((item) => item.id === id);
    if (!transaction) return;
    setDeleteDialog({
      type: "single",
      ids: [id],
      transactionNumber: transaction.nomor,
    })
  };

  const confirmDelete = async () => {
    if (!deleteDialog || isDeleting) return
    const idsToDelete = deleteDialog.ids
    setIsDeleting(true)

    try {
      for (const id of idsToDelete) {
        const res = await fetch(`${getBaseUrl()}/transactions/${id}`, {
          method: "DELETE",
          headers: getHeaders(),
        });
        if (!res.ok) {
          throw new Error(`Gagal menghapus transaksi dengan ID ${id}`);
        }
      }
      toast.success(deleteDialog.type === "single" ? "Transaksi berhasil dihapus." : `${idsToDelete.length} transaksi berhasil dihapus.`)
      setSelectedIds((current) => current.filter((id) => !idsToDelete.includes(id)))
      setDeleteDialog(null)
      await fetchTransactions();
    } catch (error) {
      console.error("Gagal menghapus transaksi:", error);
      toast.error(deleteDialog.type === "single" ? "Gagal menghapus transaksi." : "Gagal menghapus beberapa transaksi.");
    } finally {
      setIsDeleting(false)
    }
  }

  const flattenedData = transactions.map((t) => ({
    id: t.id,
    tanggal: t.tanggal,
    tanggalDisplay: t.tanggalDisplay,
    waktu: t.waktu,
    createdAt: t.createdAt,
    nomor: t.nomor,
    kategori: t.kategori,
    status: t.status,
    sn: t.sn,
    merek: t.merek,
    asal: t.asal || "-",
    tujuan: t.tujuan || "-",
    keterangan: t.keterangan || "-",
  }));

  const filteredData = flattenedData.filter((item) => {
    // Implementasi multi-search: mencari pada Nomor, Serial Number, dan Keterangan PA
    const matchesSearch = item.nomor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.keterangan.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesKategori = filterKategori === "all" || item.kategori === filterKategori;
    return matchesSearch && matchesKategori;
  }).sort((a, b) => {
    // Pengurutan secara default (Terbaru ke Terlama)
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.tanggal).getTime();
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.tanggal).getTime();
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    // Fallback sort jika tanggal presisi sama persis
    return b.id.toString().localeCompare(a.id.toString());
  });
  const hasActiveFilter = searchTerm.length > 0 || filterKategori !== "all";

  const handleExportExcel = async () => {
    if (filteredData.length === 0) {
      toast.error("Tidak ada data riwayat yang sesuai dengan filter untuk diekspor.")
      return
    }

    try {
      const headers = [
        "No",
        "Tanggal",
        "ID Transaksi",
        "Kategori",
        "Status",
        "Serial Number",
        "Merek",
        "Lokasi Asal",
        "Lokasi Tujuan",
        "PA / Keterangan",
      ]

      const rows = filteredData.map((item, index) => [
        index + 1,
        item.tanggal,
        item.nomor,
        item.kategori,
        item.status,
        item.sn,
        item.merek,
        item.asal,
        item.tujuan,
        item.keterangan,
      ])

      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Riwayat Transaksi")
      const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })

      const now = new Date()
      const dateSuffix = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
      ].join("-")
      const categorySuffix =
        filterKategori === "all" ? "semua-kategori" : filterKategori.toLowerCase()
      const searchSuffix = searchTerm.trim()
        ? `-pencarian-${searchTerm
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 40)}`
        : ""
      const exportResult = await saveExportFile({
        fileName: `riwayat-${categorySuffix}${searchSuffix}-${dateSuffix}.xlsx`,
        contents: buffer,
      })

      if (!exportResult.saved) return

      toast.success(
        `${filteredData.length} data riwayat berhasil diekspor sesuai filter aktif.`,
        exportResult.path
          ? { description: `Disimpan di: ${exportResult.path}` }
          : undefined
      )
    } catch (error) {
      console.error("Gagal mengekspor riwayat transaksi:", error)
      toast.error("Gagal memproses ekspor riwayat transaksi.")
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 animate-fade-in">
      {/* Page Header */}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-4">
          <div className="flex items-center w-full overflow-x-auto pb-1 scrollbar-hide">
            <TabsList className="**:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:px-1 inline-flex h-auto w-full lg:w-auto">
              <TabsTrigger value="Menunggu" className="cursor-pointer">
                Menunggu <Badge variant="secondary">3</Badge>
              </TabsTrigger>
              <TabsTrigger value="Disetujui" className="cursor-pointer">Disetujui</TabsTrigger>
              <TabsTrigger value="Siap" className="cursor-pointer">Siap</TabsTrigger>
              <TabsTrigger value="Selesai" className="cursor-pointer">Selesai</TabsTrigger>
              <TabsTrigger value="Ditolak" className="cursor-pointer">Ditolak</TabsTrigger>
            </TabsList>
          </div>
          <div className="flex flex-row items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-64">
              <Search className="absolute top-[9px] left-3 size-4 text-muted-foreground" />
              <Input
                placeholder="Cari transaksi..."
                className="pl-9 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("shrink-0 gap-1.5 px-3 cursor-pointer", filterCategories.length > 0 && "border-primary text-primary")}
                >
                  <ListFilter className="size-4" />
                  <span className="hidden sm:inline">Filter</span>
                  {filterCategories.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                      {filterCategories.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                {categoryOptions.map((cat) => (
                  <DropdownMenuCheckboxItem
                    key={cat}
                    checked={filterCategories.includes(cat)}
                    onCheckedChange={() => toggleFilterCategory(cat)}
                    className="cursor-pointer"
                  >
                    {cat}
                  </DropdownMenuCheckboxItem>
                ))}
                {filterCategories.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer text-muted-foreground justify-center text-xs"
                      onClick={clearFilters}
                    >
                      Hapus Filter
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="px-2 shrink-0 cursor-pointer">
                  <EllipsisVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                <DropdownMenuItem><FileUp className="mr-1" />Import</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportExcel()}><FileDown className="mr-1" />Export</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {["Menunggu", "Disetujui", "Siap", "Diterima", "Selesai", "Ditolak"].map(status => {
          // Terapkan filter sebelum diteruskan ke DataTable
          const filteredByStatus = localRequests.filter(
            (req) => req.status.toLowerCase() === status.toLowerCase()
          )
          const filteredData = filterCategories.length > 0
            ? filteredByStatus.filter((req) => filterCategories.includes(req.partnerCategory))
            : filteredByStatus

          // Tambahkan filter search term
          const finalData = searchTerm.trim()
            ? filteredData.filter((req) =>
              req.requestNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
              req.partner.toLowerCase().includes(searchTerm.toLowerCase()) ||
              req.partnerCategory.toLowerCase().includes(searchTerm.toLowerCase())
            )
            : filteredData

          return (
            <TabsContent key={status} value={status} className="mt-0">
              <DataTable
                data={finalData}
                onRowClick={(item) => setSelectedRequest(item)}
                onStatusChange={handleStatusChange}
              />
            </TabsContent>
          )
        })}
      </Tabs>

      {/* Request Detail Drawer */}
      <RequestDetailDrawer
        item={selectedRequest}
        open={selectedRequest !== null}
        onClose={() => setSelectedRequest(null)}
        isMobile={isMobile}
      />

      <AlertDialog open={deleteDialog !== null} onOpenChange={(open) => !open && !isDeleting && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteDialog?.type === "bulk" ? "Hapus beberapa transaksi?" : "Hapus transaksi ini?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.type === "bulk"
                ? `${deleteDialog.ids.length} transaksi akan dihapus permanen dari riwayat.`
                : `Transaksi ${deleteDialog?.transactionNumber} akan dihapus permanen dari riwayat.`}
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

/**
 * Drawer detail permintaan. Menampilkan informasi lengkap dari sebuah request.
 */
function RequestDetailDrawer({
  item,
  open,
  onClose,
  isMobile,
}: {
  item: DashboardRequest | null
  open: boolean
  onClose: () => void
  isMobile: boolean
}) {
  if (!item) return null

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "menunggu": return "bg-amber-500/10 text-amber-600 border-amber-500/20"
      case "disetujui": return "bg-blue-500/10 text-blue-600 border-blue-500/20"
      case "siap": return "bg-purple-500/10 text-purple-600 border-purple-500/20"
      case "diterima":
      case "selesai": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
      case "ditolak":
      case "dibatalkan": return "bg-rose-500/10 text-rose-600 border-rose-500/20"
      default: return "bg-muted text-muted-foreground"
    }
  }

  return (
    <Drawer direction={"bottom"} open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <DrawerHeader className="gap-1">
          <DrawerTitle>{item.requestNumber}</DrawerTitle>
          <DrawerDescription>
            Detail Permintaan
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4 text-sm">

          {/* Daftar Item */}
          <div className="flex flex-col gap-3">
            {item.status.toLowerCase() === "siap" && item.requestAllocations && item.requestAllocations.length > 0 ? (
              <div className="rounded-lg border overflow-hidden overflow-x-auto">
                <Table className="whitespace-nowrap">
                  <TableHeader className="sticky top-0 z-20 bg-muted shadow-sm">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-12">No</TableHead>
                      <TableHead>No. Material</TableHead>
                      <TableHead>Nama Material</TableHead>
                      <TableHead>Serial Number</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                      <TableHead className="text-right">Satuan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {item.requestAllocations.map((ra, idx) => (
                      <TableRow key={ra.id}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{ra.materialNumber}</TableCell>
                        <TableCell className="truncate max-w-[200px]" title={ra.materialName}>{ra.materialName}</TableCell>
                        <TableCell className="text-muted-foreground">{ra.serialNumber || "-"}</TableCell>
                        <TableCell className="text-right font-medium">{ra.quantity}</TableCell>
                        <TableCell className="text-right font-medium">{ra.unit}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : item.requestItems && item.requestItems.length > 0 ? (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-12">No</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Merek</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {item.requestItems.map((ri, idx) => (
                      <TableRow key={ri.id}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{ri.category}</TableCell>
                        <TableCell>{ri.brand}</TableCell>
                        <TableCell className="text-right font-medium">{ri.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground italic">Tidak ada item.</p>
            )}
          </div>
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Tutup</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
