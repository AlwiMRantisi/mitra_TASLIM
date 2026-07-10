import { useState, useEffect } from "react"
import { DataTable } from "@/features/transactions/components/request-table"
import { Search, EllipsisVertical, FileUp, FileDown, ListFilter, Loader2 } from "lucide-react"
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

const getUnitByCategory = (categoryName?: string) => {
  if (!categoryName) return "Unit";
  const name = categoryName.toLowerCase();
  if (name.includes("kabel") || name.includes("foc") || name.includes("dropwire")) {
    return "Meter";
  }
  return "Unit";
};

const getCleanCategoryName = (categoryName?: string) => {
  if (!categoryName) return "-";
  const name = categoryName.toLowerCase();
  if (name.includes("ont")) return "ONT";
  if (name.includes("dropwire") || name.includes("kabel") || name.includes("foc")) return "DropWire";
  return categoryName;
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

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`${getBaseUrl()}/requests/${id}/status`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({ status: newStatus.toUpperCase() })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Gagal mengubah status");
      }

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
      const res = await fetch(`${getBaseUrl()}/requests`, {
        method: "GET",
        headers: getHeaders(),
      });
      if (!res.ok) {
        throw new Error("Gagal mengambil data permintaan");
      }
      const data: DashboardRequest[] = await res.json();

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
                Menunggu <Badge variant="secondary">3</Badge>
              </TabsTrigger>
              <TabsTrigger value="Disetujui" className="cursor-pointer">Disetujui</TabsTrigger>
              <TabsTrigger value="Siap" className="cursor-pointer">Siap</TabsTrigger>
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
      />
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
}: {
  item: DashboardRequest | null
  open: boolean
  onClose: () => void
}) {
  const [detailData, setDetailData] = useState<DashboardRequest | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!open || !item?.id) {
      setDetailData(null)
      return
    }

    const fetchDetail = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`${getBaseUrl()}/requests/${item.id}`, {
          method: "GET",
          headers: getHeaders(),
        })
        if (!res.ok) throw new Error("Gagal mengambil detail")
        const data = await res.json()
        const formatted: DashboardRequest = {
          id: data.id,
          requestNumber: data.requestNumber,
          requesterName: data.requester?.profile?.nama || data.requester?.username,
          partnerCategory: data.requester?.profile?.partnerType || "Mitra",
          status: data.status,
          notes: data.notes || "-",
          requestedAt: data.requestedAt,
          itemsCount: data.requestItems?.reduce((acc: number, ri: any) => acc + ri.quantity, 0),
          requestItems: data.requestItems?.map((ri: any) => ({
            id: ri.id,
            category: ri.materialCategory?.nama,
            brand: ri.brand?.nama,
            model: ri.model?.nama || ri.model?.name || "-",
            quantity: ri.quantity,
            unit: getUnitByCategory(ri.materialCategory?.nama)
          })),
          requestAllocations: data.requestItems?.flatMap((ri: any) =>
            ri.allocations?.map((alloc: any) => ({
              id: alloc.id,
              materialNumber: alloc.item?.paNumber || "-",
              materialCategory: ri.materialCategory?.nama,
              brand: alloc.item?.brand?.nama || ri.brand?.nama,
              materialName: `${getCleanCategoryName(ri.materialCategory?.nama)} ${alloc.item?.brand?.nama || ri.brand?.nama}${alloc.item?.model?.nama ? ` (${alloc.item.model.nama})` : ''}`,
              serialNumber: alloc.item?.serialNumber,
              quantity: 1,
              unit: getUnitByCategory(ri.materialCategory?.nama)
            })) || []
          )
        }
        setDetailData(formatted)
      } catch (error) {
        console.error("Gagal memuat detail request:", error)
        toast.error("Gagal memuat detail alokasi barang")
      } finally {
        setIsLoading(false)
      }
    }

    fetchDetail()
  }, [open, item?.id])

  if (!item) return null

  const displayItem = detailData || item

  return (
    <Drawer direction={"bottom"} open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <DrawerHeader className="gap-1">
          <DrawerTitle>{displayItem.requestNumber}</DrawerTitle>
          <DrawerDescription>
            Detail Permintaan
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4 text-sm min-h-[150px] justify-center">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Memuat detail alokasi...</span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {['SIAP', 'SELESAI', 'DITERIMA'].includes(displayItem.status?.toUpperCase() || "") ? (
                <div className="rounded-lg border overflow-hidden overflow-x-auto">
                  <Table className="whitespace-nowrap">
                    <TableHeader className="sticky top-0 z-20 bg-muted shadow-sm">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-12">No</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead>Nama Material</TableHead>
                        <TableHead>Material Number</TableHead>
                        <TableHead>Merek</TableHead>
                        <TableHead className="text-right">Jumlah</TableHead>
                        <TableHead className="text-right">Satuan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayItem.requestAllocations && displayItem.requestAllocations.length > 0 ? (
                        displayItem.requestAllocations.map((ra, idx) => (
                          <TableRow key={ra.id}>
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-medium">{ra.materialCategory}</TableCell>
                            <TableCell className="truncate max-w-[200px]" title={ra.materialName}>{ra.materialName}</TableCell>
                            <TableCell className="font-medium text-muted-foreground" title={ra.materialNumber}>{ra.materialNumber}</TableCell>
                            <TableCell>{ra.brand}</TableCell>
                            <TableCell className="text-right font-medium">{ra.quantity}</TableCell>
                            <TableCell className="text-right font-medium">Unit</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                            Belum ada alokasi material spesifik.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              ) : displayItem.status?.toUpperCase() === 'DISETUJUI' ? (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-12">No</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead>Merek</TableHead>
                        <TableHead>Tipe/Model</TableHead>
                        <TableHead className="text-right">Jumlah</TableHead>
                        <TableHead className="text-right">Satuan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayItem.requestItems && displayItem.requestItems.length > 0 ? (
                        displayItem.requestItems.map((ri, idx) => (
                          <TableRow key={ri.id}>
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-medium">{ri.category}</TableCell>
                            <TableCell>{ri.brand}</TableCell>
                            <TableCell>{ri.model || "-"}</TableCell>
                            <TableCell className="text-right font-medium">{ri.quantity}</TableCell>
                            <TableCell className="text-right font-medium">Unit</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                            Tidak ada item.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              ) : displayItem.requestItems && displayItem.requestItems.length > 0 ? (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-12">No</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead>Merek</TableHead>
                        <TableHead>Tipe/Model</TableHead>
                        <TableHead className="text-right">Jumlah</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayItem.requestItems.map((ri, idx) => (
                        <TableRow key={ri.id}>
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-medium">{ri.category}</TableCell>
                          <TableCell>{ri.brand}</TableCell>
                          <TableCell>{ri.model || "-"}</TableCell>
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
          )}
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
