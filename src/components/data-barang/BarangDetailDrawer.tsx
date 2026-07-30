import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"

import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Edit, Loader2, History, Info, Copy, Check } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import type { BarangUnit, StatusUnit, RiwayatUnit } from "@/types/inventory"
import { toast } from "sonner"

interface BarangDetailDrawerProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  detailBarang: BarangUnit | null
  userRole?: string
  onOpenEdit: (item: BarangUnit) => void
  getStatusBadgeProps: (status: StatusUnit) => { text: string; dotClass?: string; badgeClass?: string }
  formatTanggal: (tgl: string) => string
  ADMIN_LOCATION: string
  getBaseUrl: () => string
  getHeaders: () => Record<string, string>
}

export function BarangDetailDrawer({
  isOpen,
  onOpenChange,
  detailBarang,
  userRole,
  onOpenEdit,
  getStatusBadgeProps,
  formatTanggal,
  ADMIN_LOCATION,
  getBaseUrl,
  getHeaders,
}: BarangDetailDrawerProps) {
  const isMobile = useIsMobile()
  const [history, setHistory] = useState<RiwayatUnit[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Berhasil menyalin Serial Number")
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  useEffect(() => {
    if (!isOpen || !detailBarang) return

    let isMounted = true
    setIsLoadingHistory(true)

    fetch(`${getBaseUrl()}/items/${detailBarang.id}/history`, {
      method: "GET",
      headers: getHeaders(),
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!isMounted) return
        setHistory(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        console.error("Gagal memuat riwayat transaksi unit:", err)
        if (isMounted) setHistory([])
      })
      .finally(() => {
        if (isMounted) setIsLoadingHistory(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, detailBarang])

  if (!detailBarang) return null

  const badge = getStatusBadgeProps(detailBarang.status)



  // Generate fallback initial entry if history list is empty
  const displayHistory: RiwayatUnit[] =
    history.length > 0
      ? history
      : [
        {
          tanggal: detailBarang.tanggalMasuk,
          tipe: "Masuk",
          nomorSurat: "INBOUND-INIT",
          dariStatus: "Supplier / Registrasi Awal",
          keStatus: detailBarang.status,
          lokasi: detailBarang.lokasiPenyimpanan,
          catatan: "Registrasi awal unit inventaris ke dalam sistem Arxiva.",
        },
      ]

  // Reusable Timeline Chain Component
  const renderHistoryChain = () => (
    <div className="relative pl-6 space-y-3.5 my-1">
      {displayHistory.map((trx, idx) => {
        const tipeLabel = trx.tipe || trx.kategori || "Masuk"
        const nomorSurat = trx.nomorSurat || trx.nomor || "-"
        const lokasiText = trx.lokasi || trx.tujuan || trx.asal || detailBarang.lokasiPenyimpanan
        const isNotLast = idx < displayHistory.length - 1

        return (
          <div key={idx} className="relative group text-xs">
            {/* Timeline Dot Node */}
            <div
              className="absolute -left-6 top-0.5 size-2.5 rounded-full border-2 bg-foreground border-muted-foreground z-10"
            />

            {/* Connecting Vertical Line Segment (only if not last item) */}
            {isNotLast && (
              <div className="absolute -left-5 top-2.5 -bottom-4 w-0.5 bg-border/60" />
            )}

            <div className="space-y-1.5 rounded-lg">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex flex-col items-start gap-1.5">
                  <div className="font-semibold text-xs">
                    {tipeLabel}
                  </div>
                  <span className="font-medium text-muted-foreground text-xs">{nomorSurat}</span>
                </div>
                <span className="text-xs text-muted-foreground">{formatTanggal(trx.tanggal)}</span>
              </div>

              <div className="text-xs text-muted-foreground leading-snug">
                {trx.dariStatus ? (
                  <span>
                    <span className="font-medium text-foreground">{trx.dariStatus}</span>
                    <span className="mx-1 text-muted-foreground/70">➔</span>
                    <span className="font-medium text-foreground">{lokasiText}</span>
                  </span>
                ) : (
                  <span>
                    <span className="font-medium text-foreground">Lokasi:</span> {lokasiText}
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )

  // RENDER FOR DESKTOP & TABLET: Centered Modal Dialog (2-Column Split)
  if (!isMobile) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[88vh] flex flex-col p-6 border-border/80">
          <DialogHeader className="border-b pb-3 shrink-0">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <DialogTitle className="text-lg font-medium text-foreground">
                  Detail Material
                </DialogTitle>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                </div>
              </div>
              <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${badge.badgeClass || "bg-blue-400/10 text-blue-500"}`}>
                <span className="font-medium text-xs leading-none">{badge.text}</span>
              </div>
            </div>
          </DialogHeader>

          {/* Desktop 2-Column Split Body */}
          <div className="grid grid-cols-2 gap-6 overflow-y-auto flex-1">
            {/* LEFT COLUMN: INFORMASI MATERIAL */}
            <div className="space-y-2">
              <h4 className="font-medium text-foreground pb-1">
                Informasi Material
              </h4>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Serial Number (SN)</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono font-semibold text-foreground mt-0.5">{detailBarang.serialNumber}</p>
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(detailBarang.serialNumber)}>
                      {isCopied ? (
                        <Check className="size-3.5 text-green-500 scale-110 transition-transform duration-300" />
                      ) : (
                        <Copy className="size-3.5 text-muted-foreground transition-transform duration-300" />
                      )}
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground">Kategori</p>
                  <p className="text-foreground mt-0.5">{detailBarang.kategori}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Merek</p>
                  <p className="text-foreground mt-0.5">{detailBarang.merek}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tipe / Model</p>
                  <p className="text-foreground mt-0.5">{detailBarang.tipe || "-"}</p>
                </div>
              </div >
              <h4 className="font-medium text-foreground pb-1">Lokasi Material</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Lokasi Storage</p>
                  <p className="text-foreground mt-0.5">{detailBarang.lokasiPenyimpanan}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pemilik / Tempat</p>
                  <p className="text-foreground mt-0.5">{detailBarang.mitra || ADMIN_LOCATION}</p>
                </div>
              </div>
            </div >

            {/* RIGHT COLUMN: RIWAYAT MUTASI & HISTORY CHAIN */}
            < div className="space-y-3" >
              <h4 className="flex font-medium text-foreground items-center justify-between pb-1">
                <span>Riwayat Mutasi</span>
                <span className="text-xs text-muted-foreground font-normal">({displayHistory.length} Entri)</span>
              </h4>

              {
                isLoadingHistory ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground gap-2 text-xs">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    <span>Memuat riwayat transaksi...</span>
                  </div>
                ) : (
                  <div className="max-h-[52vh] overflow-y-auto pr-1.5">
                    {renderHistoryChain()}
                  </div>
                )
              }
            </div >
          </div >

          {/* Desktop Footer */}
          < DialogFooter className="shrink-0 flex-row justify-end gap-1 pt-4 border-t" >
            {userRole === "admin" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  onOpenEdit(detailBarang)
                }}
                className="gap-1.5 cursor-pointer"
              >
                <Edit className="size-3.5" />
                Edit Unit
              </Button>
            )
            }
            <DialogClose asChild>
              <Button size="sm" variant="default" className="px-4 cursor-pointer">
                Tutup
              </Button>
            </DialogClose>
          </DialogFooter >
        </DialogContent >
      </Dialog >
    )
  }

  // RENDER FOR SMARTPHONE / MOBILE: Bottom Sheet Drawer with Tabs
  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh] flex flex-col">
        {/* Mobile Header */}
        <DrawerHeader className="border-b shrink-0 pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-0.5">
              <DrawerTitle className="text-base font-bold text-foreground">
                Detail Material
              </DrawerTitle>
            </div>

            <div className={`inline-flex items-center justify-center rounded-lg px-3 py-1.5 font-semibold text-xs leading-none shrink-0 ${badge.badgeClass || "bg-blue-400/10 text-blue-500"}`}>
              {badge.text}
            </div>
          </div>
        </DrawerHeader>

        {/* Mobile Tabbed Body */}
        <div className="p-4 overflow-y-auto flex-1">
          <Tabs defaultValue="spesifikasi" className="w-full space-y-4">
            <TabsList className="w-full grid grid-cols-2 h-9">
              <TabsTrigger value="spesifikasi" className="text-xs gap-1.5">
                <Info className="size-3.5" />
                Spesifikasi
              </TabsTrigger>
              <TabsTrigger value="riwayat" className="text-xs gap-1.5">
                <History className="size-3.5" />
                Riwayat ({displayHistory.length})
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Spesifikasi Material */}
            <TabsContent value="spesifikasi" className="space-y-3 pt-1">
              <Card className="p-4 border border-border/40 rounded-lg bg-card/60">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground font-medium">Serial Number (SN)</p>
                    <div className="flex items-center gap-2">
                      <p className="font-mono font-bold text-foreground mt-0.5">{detailBarang.serialNumber}</p>
                      <Button size="sm" variant="ghost" onClick={() => copyToClipboard(detailBarang.serialNumber)}>
                        {isCopied ? (
                          <Check className="size-3.5 text-green-500 scale-110 transition-transform duration-300" />
                        ) : (
                          <Copy className="size-3.5 transition-transform duration-300" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground font-medium">Kategori</p>
                    <p className="font-medium text-foreground mt-0.5">{detailBarang.kategori}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground font-medium">Merek</p>
                    <p className="font-medium text-foreground mt-0.5">{detailBarang.merek}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground font-medium">Tipe / Model</p>
                    <p className="font-medium text-foreground mt-0.5">{detailBarang.tipe || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground font-medium">Lokasi Storage</p>
                    <p className="font-medium text-foreground mt-0.5">{detailBarang.lokasiPenyimpanan}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground font-medium">Pemilik / Tempat</p>
                    <p className="font-medium text-foreground mt-0.5">{detailBarang.mitra || ADMIN_LOCATION}</p>
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* TAB 2: Riwayat Mutasi (Compact History Chain) */}
            <TabsContent value="riwayat" className="space-y-3 pt-1">
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground gap-2 text-xs">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  <span>Memuat riwayat transaksi...</span>
                </div>
              ) : (
                renderHistoryChain()
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Mobile Footer */}
        <DrawerFooter className="border-t shrink-0 flex-row justify-end gap-2 p-4">
          {userRole === "admin" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onOpenChange(false)
                onOpenEdit(detailBarang)
              }}
              className="gap-1.5 text-xs"
            >
              <Edit className="size-3.5" />
              Edit Unit
            </Button>
          )}
          <DrawerClose asChild>
            <Button size="sm" variant="secondary" className="text-xs">
              Tutup
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
