import React from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { MoreVertical, Edit, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import type { BarangUnit, StatusUnit } from "@/types/inventory"

interface BarangMobileCardsProps {
  items: BarangUnit[]
  selectedIds: string[]
  onSelectRow: (checked: boolean, id: string) => void
  onItemClick: (item: BarangUnit) => void
  onOpenEdit: (item: BarangUnit) => void
  onDelete: (id: string) => void
  userRole?: string
  getStatusBadgeProps: (status: StatusUnit) => { text: string; dotClass: string }
  formatTanggal: (tgl: string) => string
  ADMIN_LOCATION: string
}

export function BarangMobileCards({
  items,
  selectedIds,
  onSelectRow,
  onItemClick,
  onOpenEdit,
  onDelete,
  userRole,
  getStatusBadgeProps,
  formatTanggal,
  ADMIN_LOCATION,
}: BarangMobileCardsProps) {
  return (
    <div className="space-y-3 md:hidden overflow-y-auto pr-1">
      {items.map((item) => {
        const badge = getStatusBadgeProps(item.status)
        const isSelected = selectedIds.includes(item.id)
        return (
          <Card
            key={item.id}
            className={`p-3.5 space-y-2.5 transition-all cursor-pointer border-border/60 ${
              isSelected ? "border-primary bg-primary/5" : "hover:border-border"
            }`}
            onClick={() => onItemClick(item)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {userRole === "admin" && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => onSelectRow(checked as boolean, item.id)}
                      aria-label={`Pilih ${item.serialNumber}`}
                    />
                  </div>
                )}
                <div>
                  <p className="font-mono font-bold text-sm text-foreground">{item.serialNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.merek} &bull; {item.kategori} {item.tipe ? `(${item.tipe})` : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <Badge variant="secondary" className="font-normal gap-1 px-2 py-0.5 text-[11px]">
                  <div className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                  {badge.text}
                </Badge>
                {userRole === "admin" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-7">
                        <MoreVertical className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36 text-xs">
                      <DropdownMenuItem onClick={() => onOpenEdit(item)}>
                        <Edit className="size-3.5 mr-2" />
                        Edit Unit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-rose-600 focus:text-rose-600"
                        onClick={() => onDelete(item.id)}
                      >
                        <Trash2 className="size-3.5 mr-2" />
                        Hapus
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 text-xs pt-1 border-t border-border/40 text-muted-foreground gap-y-1">
              <div>
                <span className="font-medium text-foreground">Lokasi:</span> {item.lokasiPenyimpanan}
              </div>
              <div>
                <span className="font-medium text-foreground">Pemilik:</span> {item.mitra || ADMIN_LOCATION}
              </div>
              <div>
                <span className="font-medium text-foreground">Masuk:</span> {formatTanggal(item.tanggalMasuk)}
              </div>
              {item.tanggalKeluar && (
                <div>
                  <span className="font-medium text-foreground">Keluar:</span> {formatTanggal(item.tanggalKeluar)}
                </div>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
