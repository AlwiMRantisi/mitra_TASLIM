import React, { useState, useEffect, useRef } from "react"
import { confirm } from "@tauri-apps/plugin-dialog"
import { useNavigate } from "react-router-dom"
import { Loader2, MessageSquare } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@/components/ui/drawer"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { DashboardRequest } from "@/types/transaction"
import { useAuth } from "@/lib/auth"

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

/**
 * Wrapper for tables to add dynamic top and bottom scroll shadows
 */
function ScrollShadowWrapper({ children }: { children: React.ReactNode }) {
  const [canScrollTop, setCanScrollTop] = useState(false)
  const [canScrollBottom, setCanScrollBottom] = useState(false)
  const [headerHeight, setHeaderHeight] = useState(40)
  const scrollRef = useRef<HTMLDivElement>(null)

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
      setCanScrollTop(scrollTop > 0)
      setCanScrollBottom(Math.ceil(scrollTop + clientHeight) < scrollHeight)

      const thead = scrollRef.current.querySelector('thead')
      if (thead) {
        setHeaderHeight(thead.offsetHeight)
      }
    }
  }

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver(() => checkScroll())
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    const thead = el.querySelector('thead')
    if (thead) observer.observe(thead)
    return () => observer.disconnect()
  }, [children])

  return (
    <div className="rounded-lg border overflow-hidden relative">
      <div
        ref={scrollRef}
        className="overflow-auto max-h-62 xl:max-h-92 overscroll-contain [&>div]:overflow-visible [&>div]:static"
        onScroll={checkScroll}
      >
        {children}
      </div>
      {canScrollTop && (
        <div
          className="absolute left-0 right-0 h-6 bg-linear-to-b from-card to-transparent pointer-events-none z-30"
          style={{ top: `${headerHeight}px` }}
        />
      )}
      {canScrollBottom && (
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-linear-to-t from-card to-transparent pointer-events-none rounded-b-lg z-30" />
      )}
    </div>
  )
}

/**
 * Drawer detail permintaan. Menampilkan informasi lengkap dari sebuah request.
 */
export function RequestDetailDrawer({
  item,
  open,
  onClose,
  onStatusChange,
}: {
  item: DashboardRequest | null
  open: boolean
  onClose: () => void
  onStatusChange?: (id: string, newStatus: string, remarks?: string) => void
}) {
  const {} = useAuth()
  const navigate = useNavigate()
  const [detailData, setDetailData] = useState<DashboardRequest | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // ── Reject with notes dialog ───────────────────────────────────────────
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectNotes, setRejectNotes] = useState("")
  const [isRejecting, setIsRejecting] = useState(false)

  useEffect(() => {
    if (!open || !item?.id) {
      setDetailData(null)
      return
    }

    const fetchDetail = async () => {
      setIsLoading(true)
      try {
        const response = await api.get(`/requests/${item.id}`)
        const data = response.data
        const formatted: DashboardRequest = {
          id: data.id,
          requestNumber: data.requestNumber,
          requesterName: data.requester?.profile?.nama || data.requester?.username,
          partnerCategory: data.requester?.profile?.partnerType || "Mitra",
          status: data.status,
          notes: data.notes || "-",
          adminRemarks: data.adminRemarks || data.notes,
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
              materialNumber: alloc.item?.model?.code || "-",
              materialCategory: ri.materialCategory?.nama,
              brand: alloc.item?.brand?.nama || ri.brand?.nama,
              materialName: `${getCleanCategoryName(ri.materialCategory?.nama)} ${alloc.item?.brand?.nama || ri.brand?.nama}${alloc.item?.model?.nama ? ` (${alloc.item.model.nama})` : ''}`,
              serialNumber: alloc.item?.serialNumber,
              quantity: 1,
              unit: getUnitByCategory(ri.materialCategory?.nama)
            })) || []
          ),
          deliveryDocument: data.deliveryDocument ? {
            kpSignedById: data.deliveryDocument.kpSignedById,
            picSignedById: data.deliveryDocument.picSignedById
          } : null
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

  const handleAction = async (newStatus: string, requireConfirm: boolean = false) => {
    if (!displayItem?.id || !onStatusChange) return;

    // Siapkan: navigate to prepare page instead of changing status directly
    if (newStatus === "Siap") {
      onClose()
      navigate(`/request/${displayItem.id}/prepare`)
      return;
    }

    // Tolak / Batalkan: buka dialog catatan penolakan
    if (newStatus === "Ditolak" || newStatus === "Dibatalkan") {
      setRejectNotes("")
      setRejectDialogOpen(true)
      return;
    }

    if (requireConfirm) {
      const isConfirmed = await confirm("Apakah Anda yakin ingin melakukan tindakan ini pada permintaan?");
      if (!isConfirmed) {
        return;
      }
    }

    onStatusChange(displayItem.id, newStatus);
    onClose();
  };

  const handleConfirmReject = async (newStatus: string) => {
    if (!displayItem?.id || !onStatusChange) return
    setIsRejecting(true)
    try {
      // Kirim catatan ke API sebagai adminRemarks / notes sebelum ubah status
      if (rejectNotes.trim()) {
        await api.put(`/requests/${displayItem.id}`, {
          adminRemarks: rejectNotes.trim(),
          notes: rejectNotes.trim(),
        }).catch(() => {
          // Jika endpoint PUT tidak support patch notes, coba via status endpoint
          return api.put(`/requests/${displayItem.id}/status`, {
            status: newStatus.toUpperCase(),
            adminRemarks: rejectNotes.trim(),
            notes: rejectNotes.trim(),
          })
        })
      }
      onStatusChange(displayItem.id, newStatus, rejectNotes.trim() || undefined)
      setRejectDialogOpen(false)
      setRejectNotes("")
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memproses penolakan"
      toast.error(msg)
    } finally {
      setIsRejecting(false)
    }
  }

  // Simpan newStatus yang pending saat dialog reject terbuka
  const [pendingRejectStatus, setPendingRejectStatus] = useState<string>("Ditolak")

  const isSelesai = displayItem.status?.toUpperCase() === 'SELESAI';

  return (
    <>
      <Drawer direction={"bottom"} open={open} onOpenChange={(o) => !o && onClose()}>
        <DrawerContent>
          <DrawerHeader className="gap-1">
            <DrawerTitle>{displayItem.requestNumber.toUpperCase()}</DrawerTitle>
            <DrawerDescription>
              Detail Permintaan
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4 text-sm min-h-37.5 justify-center">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Memuat detail alokasi...</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {['SIAP', 'SELESAI', 'DITERIMA'].includes(displayItem.status?.toUpperCase() || "") ? (
                  <ScrollShadowWrapper>
                    <Table className="whitespace-nowrap">
                      <TableHeader className="sticky top-0 z-20 bg-muted shadow-md">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-12">No</TableHead>
                          <TableHead>Kategori</TableHead>
                          <TableHead>No. Material</TableHead>
                          <TableHead>Nama Material</TableHead>
                          <TableHead>Merek</TableHead>
                          {isSelesai && <TableHead>SN</TableHead>}
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
                              <TableCell className="font-medium text-muted-foreground" title={ra.materialNumber}>{ra.materialNumber}</TableCell>
                              <TableCell className="truncate max-w-50" title={ra.materialName}>{ra.materialName}</TableCell>
                              <TableCell>{ra.brand}</TableCell>
                              {isSelesai && (
                                <TableCell>
                                  {ra.serialNumber || "-"}
                                </TableCell>
                              )}
                              <TableCell className="text-right font-medium">{ra.quantity}</TableCell>
                              <TableCell className="text-right font-medium">{ra.unit || "Unit"}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                              Belum ada alokasi material spesifik.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollShadowWrapper>
                ) : displayItem.requestItems && displayItem.requestItems.length > 0 ? (
                  <>
                    <ScrollShadowWrapper>
                      <Table>
                        <TableHeader className="sticky top-0 z-20 bg-muted shadow-md">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="w-12 px-4">No</TableHead>
                            <TableHead>Kategori</TableHead>
                            <TableHead>Merek</TableHead>
                            <TableHead className="text-right">Jumlah</TableHead>
                            <TableHead className="text-right px-4">Satuan</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayItem.requestItems.map((ri, idx) => (
                            <TableRow key={ri.id}>
                              <TableCell className="text-muted-foreground px-4">{idx + 1}</TableCell>
                              <TableCell className="font-medium">{ri.category}</TableCell>
                              <TableCell>{ri.brand}</TableCell>
                              <TableCell className="text-right font-medium">{ri.quantity}</TableCell>
                              <TableCell className="text-right font-medium px-4">Unit</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollShadowWrapper>
                    {['DITOLAK', 'DIBATALKAN'].includes(displayItem.status?.toUpperCase() || "") ? (
                      <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-xs">
                        <span className="font-semibold text-destructive">Catatan {displayItem.status?.toUpperCase() === "DITOLAK" ? "Penolakan" : "Pembatalan"}: </span>
                        <span className="text-foreground">{displayItem.adminRemarks || displayItem.notes || "-"}</span>
                      </div>
                    ) : displayItem.notes ? (
                      <p className="text-muted-foreground italic text-xs">Catatan: {displayItem.notes}</p>
                    ) : (
                      <p className="text-muted-foreground italic text-xs">Tidak ada catatan.</p>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground italic">Tidak ada item.</p>
                )}
              </div>
            )}
          </div>
          <DrawerFooter className="w-full pt-2">
            <div className="flex w-full gap-2">
              {['MENUNGGU'].includes(displayItem.status?.toUpperCase() || "") && (
                <>
                  <Button variant="default" className="flex-1 cursor-pointer" onClick={() => navigate(`/request/${displayItem.id}/prepare`)}>Siapkan Barang</Button>
                  <Button variant="destructive" className="flex-1 cursor-pointer" onClick={() => { setPendingRejectStatus("Ditolak"); handleAction("Ditolak", true) }}>Tolak Permintaan</Button>
                </>
              )}
              {['SIAP'].includes(displayItem.status?.toUpperCase() || "") && (
                <>
                  <Button variant="default" className="flex-1 cursor-pointer" onClick={() => navigate(`/request/${displayItem.id}/prepare`)}>Edit</Button>
                  <Button variant="destructive" className="flex-1 cursor-pointer" onClick={() => { setPendingRejectStatus("Dibatalkan"); handleAction("Dibatalkan", true) }}>Batalkan</Button>
                </>
              )}
              <DrawerClose asChild>
                <Button variant="outline" className="flex-1 cursor-pointer">Tutup</Button>
              </DrawerClose>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* ── Dialog Catatan Penolakan / Pembatalan ── */}
      <Dialog
        open={rejectDialogOpen}
        onOpenChange={(open) => {
          if (!open && !isRejecting) {
            setRejectDialogOpen(false)
            setRejectNotes("")
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-destructive" />
              {pendingRejectStatus === "Ditolak" ? "Tolak Permintaan" : "Batalkan Permintaan"}
            </DialogTitle>
            <DialogDescription>
              {pendingRejectStatus === "Ditolak"
                ? "Berikan alasan penolakan agar mitra dapat memahami keputusan ini."
                : "Berikan alasan pembatalan sebagai catatan untuk mitra."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 py-1">
            <Label htmlFor="reject-notes" className="text-sm font-medium">
              Catatan {pendingRejectStatus === "Ditolak" ? "Penolakan" : "Pembatalan"}
              <span className="text-muted-foreground font-normal ml-1">(opsional)</span>
            </Label>
            <Textarea
              id="reject-notes"
              placeholder={
                pendingRejectStatus === "Ditolak"
                  ? "Contoh: Stok ONT sedang habis, silakan ajukan ulang bulan depan..."
                  : "Contoh: Permintaan dibatalkan karena perubahan jadwal pemasangan..."
              }
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              rows={3}
              className="resize-none"
              disabled={isRejecting}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false)
                setRejectNotes("")
              }}
              disabled={isRejecting}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleConfirmReject(pendingRejectStatus)}
              disabled={isRejecting}
              className="gap-2"
            >
              {isRejecting ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Memproses...</>
              ) : (
                pendingRejectStatus === "Ditolak" ? "Ya, Tolak Permintaan" : "Ya, Batalkan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

