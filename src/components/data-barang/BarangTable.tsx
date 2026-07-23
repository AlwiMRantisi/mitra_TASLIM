import React from "react"
import { MoreVertical, Edit, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import type { BarangUnit, StatusUnit } from "@/types/inventory"

interface BarangTableProps {
  items: BarangUnit[]
  selectedIds: string[]
  onSelectAll: (checked: boolean) => void
  onSelectRow: (checked: boolean, id: string) => void
  onItemClick: (item: BarangUnit) => void
  onOpenEdit: (item: BarangUnit) => void
  onDelete: (id: string) => void
  userRole?: string
  currentPage: number
  pageSize: number
  getStatusBadgeProps: (status: StatusUnit) => { text: string; dotClass: string }
  formatTanggal: (tgl: string) => string
  ADMIN_LOCATION: string
}

export function BarangTable({
  items,
  selectedIds,
  onSelectAll,
  onSelectRow,
  onItemClick,
  onOpenEdit,
  onDelete,
  userRole,
  currentPage,
  pageSize,
  getStatusBadgeProps,
  formatTanggal,
  ADMIN_LOCATION,
}: BarangTableProps) {
  const isAllSelected =
    items.length > 0 && items.every((item) => selectedIds.includes(item.id))

  return (
    <div className="relative min-h-0 flex-1 rounded-md border border-border/60 bg-card/40 overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-md">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-12 text-center text-xs font-semibold">No.</TableHead>
            {userRole === "admin" && (
              <TableHead className="w-12 text-center">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={(checked) => onSelectAll(checked as boolean)}
                  aria-label="Pilih semua"
                />
              </TableHead>
            )}
            <TableHead className="w-44 text-xs font-semibold">Serial Number (SN)</TableHead>
            <TableHead className="w-32 text-xs font-semibold">Merek</TableHead>
            <TableHead className="w-32 text-xs font-semibold">Kategori</TableHead>
            <TableHead className="w-32 text-xs text-center font-semibold">Status</TableHead>
            <TableHead className="text-xs text-center font-semibold">Lokasi Penyimpanan</TableHead>
            {userRole === "admin" && (
              <TableHead className="w-36 text-xs font-semibold">Tempat</TableHead>
            )}
            {userRole === "admin" && (
              <TableHead className="w-12 text-right"></TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => {
            const badge = getStatusBadgeProps(item.status)
            const isSelected = selectedIds.includes(item.id)
            return (
              <TableRow
                key={item.id}
                className="hover:bg-muted/40 transition-colors cursor-pointer text-xs md:text-sm"
                onClick={() => onItemClick(item)}
                data-state={isSelected ? "selected" : undefined}
              >
                <TableCell className="text-center font-medium text-muted-foreground text-xs">
                  {(currentPage - 1) * pageSize + index + 1}
                </TableCell>
                {userRole === "admin" && (
                  <TableCell onClick={(e) => e.stopPropagation()} className="text-center">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => onSelectRow(checked as boolean, item.id)}
                      aria-label={`Pilih ${item.serialNumber}`}
                    />
                  </TableCell>
                )}
                <TableCell className="font-mono font-medium text-foreground">
                  {item.serialNumber}
                </TableCell>
                <TableCell>{item.merek}</TableCell>
                <TableCell>{item.kategori}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className="font-normal gap-1.5 px-2 py-0.5 text-xs">
                    <div className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                    {badge.text}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">{item.lokasiPenyimpanan}</TableCell>
                {userRole === "admin" && (
                  <TableCell>
                    <Badge variant="outline" className="font-normal text-xs">
                      {item.mitra || ADMIN_LOCATION}
                    </Badge>
                  </TableCell>
                )}
                {userRole === "admin" && (
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7">
                          <MoreVertical className="size-4" />
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
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
