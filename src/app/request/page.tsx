import { useState, useEffect, useRef, useMemo, useTransition } from "react"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"
import { Separator } from "@/components/ui/separator"
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

  // State untuk filter yang sedang aktif
  const [filterCategories, setFilterCategories] = useState<string[]>([])
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)

  // State lokal untuk popover filter
  const [tempFilterCategories, setTempFilterCategories] = useState<string[]>([])
  const [tempDateRange, setTempDateRange] = useState<DateRange | undefined>(undefined)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  
  const [, startTransition] = useTransition()

  const handleApplyFilter = () => {
    setIsFilterOpen(false)
    startTransition(() => {
      setFilterCategories(tempFilterCategories)
      setDateRange(tempDateRange)
    })
  }

  const handleResetFilter = () => {
    setIsFilterOpen(false)
    startTransition(() => {
      setTempFilterCategories([])
      setTempDateRange(undefined)
      setFilterCategories([])
      setDateRange(undefined)
    })
  }

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

  const filteredData = useMemo(() => {
    let data = localRequests;

    if (filterCategories.length > 0) {
      data = data.filter((req) => req.partnerCategory && filterCategories.includes(req.partnerCategory));
    }

    if (dateRange?.from || dateRange?.to) {
      data = data.filter((req) => {
        const reqDate = new Date(req.requestedAt).getTime();
        if (dateRange.from) {
          const startDate = new Date(dateRange.from).setHours(0, 0, 0, 0);
          if (reqDate < startDate) return false;
        }
        if (dateRange.to) {
          const endDate = new Date(dateRange.to).setHours(23, 59, 59, 999);
          if (reqDate > endDate) return false;
        }
        return true;
      });
    }

    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      data = data.filter((req) =>
        req.requestNumber?.toLowerCase().includes(lowerSearch) ||
        req.requesterName?.toLowerCase().includes(lowerSearch) ||
        req.notes?.toLowerCase().includes(lowerSearch) ||
        req.partnerCategory?.toLowerCase().includes(lowerSearch)
      );
    }
    
    // Global fallback sort (LIFO)
    return [...data].sort((a, b) => {
      const timeA = new Date(a.requestedAt).getTime();
      const timeB = new Date(b.requestedAt).getTime();
      return timeB - timeA;
    });
  }, [localRequests, filterCategories, dateRange, searchTerm]);

  // Pre-calculate tab data to prevent re-sorting on every render (e.g. when popover toggles)
  const tabData = useMemo(() => {
    const tabs = ["Menunggu", "Disetujui", "Siap", "Diterima", "Selesai", "Ditolak"];
    const result: Record<string, typeof filteredData> = {};
    
    tabs.forEach(status => {
      const tabLower = status.toLowerCase()
      const finalData = filteredData.filter((req) => {
        if (tabLower === "ditolak") {
          return ["ditolak", "dibatalkan"].includes(req.status.toLowerCase())
        }
        return req.status.toLowerCase() === tabLower
      })

      const sortedData = [...finalData].sort((a, b) => {
        const timeA = new Date(a.requestedAt).getTime();
        const timeB = new Date(b.requestedAt).getTime();
        const activeStatuses = ["menunggu", "disetujui", "siap"];
        if (activeStatuses.includes(tabLower)) {
          return timeA - timeB; // FIFO
        }
        return timeB - timeA; // LIFO
      });
      
      result[status] = sortedData;
    });
    
    return result;
  }, [filteredData]);

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
            <Popover open={isFilterOpen} onOpenChange={(open) => {
              setIsFilterOpen(open)
              if (open) {
                setTempFilterCategories(filterCategories)
                setTempDateRange(dateRange)
              }
            }}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("shrink-0 gap-1.5 px-3 cursor-pointer", (filterCategories.length > 0 || dateRange?.from || dateRange?.to) && "border-gray-400 text-primary")}
                >
                  <ListFilter className="size-4" />
                  <span className="hidden sm:inline">Filter</span>
                  {(filterCategories.length > 0 || dateRange?.from || dateRange?.to) && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                      {(filterCategories.length > 0 ? 1 : 0) + (dateRange?.from || dateRange?.to ? 1 : 0)}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-4" onCloseAutoFocus={(e) => e.preventDefault()}>
                <div className="flex flex-col gap-3">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm leading-none text-muted-foreground">Kategori Partner</h4>
                    <div className="flex flex-col gap-3">
                      {categoryOptions.map((cat) => (
                        <div key={cat} className="flex items-center space-x-2">
                          <Checkbox
                            id={`cat-${cat}`}
                            checked={tempFilterCategories.includes(cat)}
                            onCheckedChange={(checked) => {
                              setTempFilterCategories(prev =>
                                checked
                                  ? [...prev, cat]
                                  : prev.filter(c => c !== cat)
                              )
                            }}
                          />
                          <label
                            htmlFor={`cat-${cat}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {cat}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm leading-none text-muted-foreground">Rentang Tanggal</h4>
                    <div className="border rounded-md">
                      <Calendar
                        mode="range"
                        defaultMonth={tempDateRange?.from}
                        selected={tempDateRange}
                        onSelect={setTempDateRange}
                        numberOfMonths={1}
                        className="p-3"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleResetFilter} className="cursor-pointer">Reset</Button>
                    <Button size="sm" onClick={handleApplyFilter} className="cursor-pointer">Terapkan</Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {["Menunggu", "Disetujui", "Siap", "Diterima", "Selesai", "Ditolak"].map(status => {
          const tabLower = status.toLowerCase()

          // Tentukan kolom mana yang disembunyikan berdasarkan tab
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

          return (
            <TabsContent key={status} value={status} className="mt-0 flex flex-col gap-4 min-h-0">
              <DataTable
                data={tabData[status] || []}
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


