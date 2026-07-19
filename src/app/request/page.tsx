import { useState, useEffect, useRef } from "react"
import { DataTable } from "@/features/transactions/components/request-table"
import { RequestDetailDrawer } from "@/features/transactions/components/request-detail-drawer"
import { Search, EllipsisVertical, FileUp, FileDown, ListFilter, Loader2, PenTool } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { saveExportFile } from "@/lib/export-file"
import * as XLSX from "xlsx"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { useAuth } from "@/lib/auth"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@/components/ui/drawer"
import { DigitalSignatureDialog } from "./components/DigitalSignatureDialog"
import { api } from "@/lib/api"
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
  const [selectedRequest, setSelectedRequest] = useState<DashboardRequest | null>(null)
  const [localRequests, setLocalRequests] = useState<DashboardRequest[]>([])

  // Ambil semua nilai unik partnerCategory sebagai opsi filter
  const categoryOptions = Array.from(
    new Set(localRequests.map((r) => r.partnerCategory).filter((c): c is string => !!c))
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

  const countMenunggu = localRequests.filter(req => req.status.toLowerCase() === "menunggu").length;
  const countDisetujui = localRequests.filter(req => req.status.toLowerCase() === "disetujui").length;
  const countSiap = localRequests.filter(req => req.status.toLowerCase() === "siap").length;

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await api.put(`/requests/${id}/status`, { status: newStatus.toUpperCase() });

      setLocalRequests(prev => prev.map(req => {
        if (req.id === id) {
          return { ...req, status: newStatus }
        }
        return req
      }))
      toast.success(`Status transaksi berhasil diubah menjadi ${newStatus}`)
    } catch (error: any) {
      toast.error(error.message || "Gagal mengubah status transaksi")
    }
  }

  /**
   * Mengambil seluruh data riwayat request dari backend.
   */
  const fetchRequests = async () => {
    try {
      const res = await api.get(`/requests`);
      const data: DashboardRequest[] = res.data;

      // Jika user adalah mitra, sembunyikan request mitra lain
      setLocalRequests(
        user?.role === "mitra"
          ? data.filter((req) => {
            const reqMitra = req.requesterName?.trim().toLowerCase() || "";
            return (
              reqMitra === user.displayName?.trim().toLowerCase() ||
              reqMitra === user.username?.trim().toLowerCase() ||
              (user.identityCode && reqMitra.includes(user.identityCode.trim().toLowerCase()))
            )
          })
          : data
      );
    } catch (error) {
      console.error("Gagal mengambil data permintaan:", error);
      toast.error("Gagal memuat data permintaan.");
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [user])

  const filteredData = localRequests.filter((item) => {
    const matchesSearch = item.requestNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.requesterName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  }).sort((a, b) => {
    const timeA = new Date(a.requestedAt).getTime();
    const timeB = new Date(b.requestedAt).getTime();
    return timeB - timeA;
  });

  const handleExportExcel = async () => {
    if (filteredData.length === 0) {
      toast.error("Tidak ada data riwayat yang sesuai dengan filter untuk diekspor.")
      return
    }

    try {
      const headers = [
        "No",
        "Tanggal",
        "No Request",
        "Nama Pemohon",
        "Tipe Partner",
        "Status",
        "Catatan",
        "Jumlah Item"
      ]

      const rows = filteredData.map((item, index) => [
        index + 1,
        new Date(item.requestedAt).toLocaleDateString(),
        item.requestNumber,
        item.requesterName,
        item.partnerCategory || "-",
        item.status,
        item.notes || "-",
        item.itemsCount || 0
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
      const categorySuffix = "semua-kategori"
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
                Menunggu {countMenunggu > 0 && <Badge variant="secondary">{countMenunggu}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="Disetujui" className="cursor-pointer">
                Disetujui {countDisetujui > 0 && <Badge variant="secondary">{countDisetujui}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="Siap" className="cursor-pointer">
                Siap {countSiap > 0 && <Badge variant="secondary">{countSiap}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="Selesai" className="cursor-pointer">Selesai</TabsTrigger>
              <TabsTrigger value="Ditolak" className="cursor-pointer">Ditolak / Batal</TabsTrigger>
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
          </div>
        </div>

        {["Menunggu", "Disetujui", "Siap", "Diterima", "Selesai", "Ditolak"].map(status => {
          // Terapkan filter sebelum diteruskan ke DataTable
          const filteredByStatus = localRequests.filter((req) => {
            if (status.toLowerCase() === "ditolak") {
              return ["ditolak", "dibatalkan"].includes(req.status.toLowerCase())
            }
            return req.status.toLowerCase() === status.toLowerCase()
          })
          const filteredData = filterCategories.length > 0
            ? filteredByStatus.filter((req) => req.partnerCategory && filterCategories.includes(req.partnerCategory))
            : filteredByStatus

          // Tambahkan filter search term
          const finalData = searchTerm.trim()
            ? filteredData.filter((req) =>
              req.requestNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              req.requesterName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              req.partnerCategory?.toLowerCase().includes(searchTerm.toLowerCase())
            )
            : filteredData

          // Tentukan kolom mana yang disembunyikan berdasarkan tab
          const tabLower = status.toLowerCase()
          let hiddenColumns: string[] = []
          if (["menunggu", "disetujui"].includes(tabLower)) {
            hiddenColumns.push("document")
          }
          if (["selesai", "diterima", "ditolak"].includes(tabLower)) {
            hiddenColumns.push("actions")
          }
          if (["ditolak"].includes(tabLower)) {
            hiddenColumns.push("document")
          }

          // Context-aware sorting
          finalData.sort((a, b) => {
            const timeA = new Date(a.requestedAt).getTime();
            const timeB = new Date(b.requestedAt).getTime();
            const activeStatuses = ["menunggu", "disetujui", "siap"];
            if (activeStatuses.includes(tabLower)) {
              return timeA - timeB; // FIFO
            }
            return timeB - timeA; // LIFO
          });

          return (
            <TabsContent key={status} value={status} className="mt-0 flex flex-col gap-4 min-h-0">
              <DataTable
                data={finalData}
                onRowClick={(item) => setSelectedRequest(item)}
                onStatusChange={handleStatusChange}
                hiddenColumns={hiddenColumns}
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
        onStatusChange={handleStatusChange}
      />
    </div>
  )
}


