import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { CheckCircle2, Loader2, ScanLine, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHead,
  TableRow,
} from "@/components/ui/table"
import { PeminjamanMitraService } from "@/services/peminjamanMitraService"
import type { ScanSnPayload } from "@/services/peminjamanMitraService"

type ScanParty = "provider" | "receiver"

interface InterPartnerScanModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  requestId: string
  requestNumber: string
  party: ScanParty
  title: string
  description: string
  items: { id: string | number; category: string; brand: string; quantity: number; unit: string }[]
  onSuccess: () => void
}

const isTextInputTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest("input, textarea, [contenteditable='true']"))
}

const normalize = (str: string) => str.trim().toUpperCase()

export function InterPartnerScanModal({
  open,
  onOpenChange,
  requestId,
  requestNumber,
  party,
  title,
  description,
  items,
  onSuccess,
}: InterPartnerScanModalProps) {
  const [activeItemIndex, setActiveItemIndex] = useState(0)
  const [inputMode, setInputMode] = useState<"auto" | "manual">("auto")
  const [scannedCodes, setScannedCodes] = useState<string>( "")
  const [scannedByItem, setScannedByItem] = useState<Record<string, string[]>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const scannedCodesRef = useRef("")
  const lastScanRef = useRef<{ code: string; time: number }>({ code: "", time: 0 })
  const lastEnterTimeRef = useRef<number>(0)

  const activeItem = items[activeItemIndex]
  const itemIdKey = activeItem ? String(activeItem.id) : ""
  const activeScanned = activeItem ? (scannedByItem[itemIdKey] ?? []) : []

  const resetState = useCallback(() => {
    setActiveItemIndex(0)
    setInputMode("auto")
    setScannedCodes("")
    scannedCodesRef.current = ""
    setScannedByItem({})
    setIsSubmitting(false)
  }, [])

  useEffect(() => {
    if (open) resetState()
  }, [open, resetState])

  const updateScannedCodes = useCallback((value: string | ((prev: string) => string)) => {
    const nextValue = typeof value === "function" ? value(scannedCodesRef.current) : value
    scannedCodesRef.current = nextValue
    setScannedCodes(nextValue)
  }, [])

  const focusInput = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [])

  useEffect(() => {
    if (open && inputMode === "auto") focusInput()
  }, [open, inputMode, focusInput, activeItemIndex])

  // ── Global keyboard listener for auto scan ─────────────────────────────
  useEffect(() => {
    if (!open || inputMode !== "auto") return

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) {
        return
      }
      const isSupportedKey = event.key.length === 1 || event.key === "Backspace" || event.key === "Enter"
      if (!isSupportedKey || isTextInputTarget(event.target)) return

      event.preventDefault()
      inputRef.current?.focus()

      if (event.key === "Enter") {
        const now = Date.now()
        if (now - lastEnterTimeRef.current < 200) return
        lastEnterTimeRef.current = now

        const currentCode = scannedCodesRef.current
        if (currentCode && currentCode.trim()) {
          void handleScan(currentCode)
        }
        return
      }
      if (event.key === "Backspace") {
        updateScannedCodes((current) => current.slice(0, -1))
        return
      }
      updateScannedCodes((current) => `${current}${event.key}`)
    }

    window.addEventListener("keydown", handleWindowKeyDown)
    return () => window.removeEventListener("keydown", handleWindowKeyDown)
  }, [open, inputMode, updateScannedCodes])

  const handleScan = useCallback(
    (codeOverride?: string) => {
      if (!activeItem) return
      const sn = (codeOverride ?? scannedCodesRef.current).trim()
      if (!sn) return

      const now = Date.now()
      if (
        (lastScanRef.current.code.toUpperCase() === sn.toUpperCase() && now - lastScanRef.current.time < 500) ||
        now - lastScanRef.current.time < 120
      ) {
        return
      }
      lastScanRef.current = { code: sn, time: now }

      updateScannedCodes("")

      const itemId = String(activeItem.id)
      const currentScanned = scannedByItem[itemId] ?? []
      if (currentScanned.some((c) => normalize(c) === normalize(sn))) {
        toast.error("Serial number sudah discan untuk barang ini", { description: sn })
        focusInput()
        return
      }

      if (currentScanned.length >= activeItem.quantity) {
        toast.error(`Jumlah untuk barang ini sudah penuh (${activeItem.quantity} ${activeItem.unit})`)
        focusInput()
        return
      }

      setScannedByItem((prev) => ({
        ...prev,
        [itemId]: [...(prev[itemId] ?? []), sn],
      }))
      toast.success("Berhasil discan", { description: sn })

      focusInput()
    },
    [activeItem, scannedByItem, updateScannedCodes, focusInput]
  )

  const handleRemoveScanned = useCallback(
    (itemId: string, sn: string) => {
      setScannedByItem((prev) => ({
        ...prev,
        [itemId]: (prev[itemId] ?? []).filter((c) => normalize(c) !== normalize(sn)),
      }))
      focusInput()
    },
    [focusInput]
  )

  const isAllComplete = useMemo(
    () =>
      items.every((item) => {
        const count = scannedByItem[String(item.id)]?.length ?? 0
        return count >= item.quantity
      }),
    [items, scannedByItem]
  )

  const handleSubmit = async () => {
    if (!isAllComplete) {
      toast.error("Belum semua barang lengkap discan sesuai jumlah.")
      return
    }
    if (!requestId) return

    setIsSubmitting(true)
    try {
      const scanItems: ScanSnPayload["items"] = items.map((item) => {
        const serialNumbers = scannedByItem[String(item.id)] ?? []
        const scannedAt = new Date().toISOString()
        if (party === "provider") {
          return {
            id: String(item.id),
            donorSerialNumber: serialNumbers.join(","),
            donorScannedAt: scannedAt,
          }
        }
        return {
          id: String(item.id),
          receiverSerialNumber: serialNumbers.join(","),
          receiverScannedAt: scannedAt,
        }
      })

      await PeminjamanMitraService.saveScan(requestId, {
        scanParty: party,
        items: scanItems,
      })

      toast.success(
        party === "provider"
          ? "Scan oleh mitra pemberi selesai. Mitra penerima menunggu validasi akhir."
          : "Validasi akhir oleh mitra penerima berhasil dilakukan."
      )
      onSuccess()
      onOpenChange(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan hasil scan"
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-xl flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
            {requestNumber ? <span className="font-mono"> (No. {requestNumber})</span> : null}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar flex flex-col gap-5">
          {/* Item progress */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">Progress Barang</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {items.map((item, idx) => {
                const count = scannedByItem[item.id]?.length ?? 0
                const done = count >= item.quantity
                const isActive = idx === activeItemIndex
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveItemIndex(idx)}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      isActive ? "border-primary bg-primary/10" : "border-neutral-800 bg-neutral-950/50 hover:bg-neutral-900/60"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs font-semibold ${done ? "text-emerald-400" : isActive ? "text-primary" : "text-muted-foreground"}`}>
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.category}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.brand}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {done && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                      <Badge variant="outline" className="font-normal">
                        {count}/{item.quantity} {item.unit}
                      </Badge>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Active item + scanner */}
          {activeItem && (
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 px-4 py-3">
                <p className="text-sm text-muted-foreground">Sedang scan untuk</p>
                <p className="text-base font-semibold mt-0.5">
                  {activeItem.category}
                  <span className="text-muted-foreground font-normal"> ({activeItem.brand})</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Dibutuhkan {activeItem.quantity} {activeItem.unit}, sudah {activeScanned.length}
                </p>
              </div>

              <Tabs
                value={inputMode}
                onValueChange={(value) => {
                  setInputMode(value as "auto" | "manual")
                  focusInput()
                }}
                className="flex flex-col gap-3"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="auto">Auto (Scanner)</TabsTrigger>
                  <TabsTrigger value="manual">Manual</TabsTrigger>
                </TabsList>

                <TabsContent value="auto" className="mt-0">
                  <Input
                    ref={inputRef}
                    value={scannedCodes}
                    onChange={(e) => updateScannedCodes(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        void handleScan(scannedCodesRef.current)
                      }
                    }}
                    placeholder="Serial Number"
                    className="hidden"
                  />
                  <div className="flex items-center justify-center gap-4 rounded-lg border border-dashed border-neutral-800 bg-muted/20 px-6 py-8 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <ScanLine className="size-7 animate-pulse" />
                      </div>
                      <p className="text-sm font-medium">Silakan scan serial number</p>
                      <p className="text-xs text-muted-foreground">
                        Serial number akan otomatis tertangkap dan masuk ke daftar barang ini.
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="manual" className="mt-0 flex flex-col gap-3">
                  <Label htmlFor="scan-manual">Serial Number</Label>
                  <Input
                    ref={inputRef}
                    id="scan-manual"
                    value={scannedCodes}
                    onChange={(e) => updateScannedCodes(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        void handleScan(scannedCodesRef.current)
                      }
                    }}
                    placeholder="Masukkan serial number"
                  />
                  <Button className="w-full" onClick={() => void handleScan(scannedCodesRef.current)}>
                    Tambah
                  </Button>
                </TabsContent>
              </Tabs>

              {/* Scanned list for active item */}
              <div className="overflow-hidden rounded-lg border border-neutral-800">
                <Table>
                  <TableHeader className="bg-neutral-900/80">
                    <TableRow className="border-neutral-800 hover:bg-transparent">
                      <TableHead className="pl-4 text-neutral-400">No</TableHead>
                      <TableHead className="text-neutral-400">Serial Number</TableHead>
                      <TableHead className="text-right pr-4 text-neutral-400"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeScanned.length > 0 ? (
                      activeScanned.map((sn, idx) => (
                        <TableRow key={`${sn}-${idx}`} className="border-neutral-800 hover:bg-transparent">
                          <TableCell className="pl-4 text-neutral-400">{idx + 1}</TableCell>
                          <TableCell className="text-sm font-mono text-neutral-200">{sn}</TableCell>
                          <TableCell className="text-right pr-4">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive cursor-pointer"
                              onClick={() => handleRemoveScanned(itemIdKey, sn)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow className="border-neutral-800 hover:bg-transparent">
                        <TableCell colSpan={3} className="h-20 text-center text-sm text-muted-foreground">
                          Belum ada serial number discan untuk barang ini
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t bg-neutral-900/40 flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {isAllComplete ? (
              <span className="text-emerald-400">Semua barang sudah lengkap discan.</span>
            ) : (
              <span>
                {items.filter((it) => (scannedByItem[it.id]?.length ?? 0) >= it.quantity).length} dari {items.length} barang
                lengkap.
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !isAllComplete}
              className="gap-2"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Simpan Hasil Scan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
