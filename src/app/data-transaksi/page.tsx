import { useState, useEffect } from "react"
import { DataTable } from "@/components/data-table"
import { Card } from "@/components/ui/card"
import { Download, Plus, Search, Trash2, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"
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
  const [searchTerm, setSearchTerm] = useState("")
  const [filterKategori, setFilterKategori] = useState("all")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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
          ? data.filter(
            (transaction) =>
              transaction.mitra?.trim().toLowerCase() ===
              user.displayName.trim().toLowerCase()
          )
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
    <div className="flex flex-col gap-4 p-4 md:p-6 lg:p-8 animate-fade-in">
      {/* Page Header */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute top-2 left-3 size-4 text-muted-foreground" />
              <Input
                placeholder="Cari nomor transaksi..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Select value={filterKategori} onValueChange={setFilterKategori}>
                <SelectTrigger className="w-[160px] py-0">
                  <SelectValue placeholder="Kategori Transaksi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {KATEGORI_OPTIONS.map((kategori) => (
                    <SelectItem key={kategori} value={kategori}>{kategori}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(searchTerm || filterKategori !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSearchTerm("")
                    setFilterKategori("all")
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
              disabled={filteredData.length === 0}
            >
              <Download className="size-4" />
              <span>Export Excel</span>
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md transition-all active:scale-[0.98]"
            >
              <Link to="/barang-masuk" className="flex flex-row items-center">
                <Plus className="size-4" />
                <span>Buat Transaksi</span>
              </Link>
            </Button>
          </div>
        </div>
      </Card>
      <DataTable
        data={filteredData}
        isFiltered={hasActiveFilter}
        resetPaginationKey={`${searchTerm}|${filterKategori}`}
        showSelection={user?.role === "admin"}
        showActions={user?.role === "admin"}
        onSelectionChange={
          user?.role === "admin" ? setSelectedIds : undefined
        }
        onDeleteRow={user?.role === "admin" ? handleDeleteRow : undefined}
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
