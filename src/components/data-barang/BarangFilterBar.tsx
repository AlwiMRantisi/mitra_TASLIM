import React from "react"
import { Search, Trash2, Download, Plus, RotateCcw } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Link } from "react-router-dom"
import type { StatusUnit } from "@/types/inventory"

const STATUS_OPTIONS: StatusUnit[] = ["Tersedia", "Terdistribusi", "Rusak", "Hilang"]

interface BarangFilterBarProps {
  searchTerm: string
  onSearchChange: (val: string) => void
  filterStatus: string
  onStatusChange: (val: string) => void
  filterCategory: string
  onCategoryChange: (val: string) => void
  filterBrand: string
  onBrandChange: (val: string) => void
  categories: string[]
  brands: string[]
  onResetFilter: () => void
  selectedCount: number
  onBulkDelete: () => void
  onExportExcel: () => void
  userRole?: string
  hasFilteredData: boolean
}

export function BarangFilterBar({
  searchTerm,
  onSearchChange,
  filterStatus,
  onStatusChange,
  filterCategory,
  onCategoryChange,
  filterBrand,
  onBrandChange,
  categories,
  brands,
  onResetFilter,
  selectedCount,
  onBulkDelete,
  onExportExcel,
  userRole,
  hasFilteredData,
}: BarangFilterBarProps) {
  const isFiltered =
    searchTerm.trim().length > 0 ||
    filterStatus !== "all" ||
    filterCategory !== "all" ||
    filterBrand !== "all"

  return (
    <Card className="shrink-0 p-4 shadow-sm border-border/60 bg-card/50 backdrop-blur-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Search & Select Filters */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-xs">
            <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input
              placeholder="Cari SN, merek, tipe, lokasi..."
              className="pl-9 h-9 text-xs md:text-sm"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <Select value={filterStatus} onValueChange={onStatusChange}>
            <SelectTrigger className="w-33.75 h-9">
              <SelectValue placeholder="Status Unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Category Filter */}
          <Select value={filterCategory} onValueChange={onCategoryChange}>
            <SelectTrigger className="w-35 h-9">
              <SelectValue placeholder="Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Brand Filter */}
          {brands.length > 0 && (
            <Select value={filterBrand} onValueChange={onBrandChange}>
              <SelectTrigger className="w-32.5 h-9">
                <SelectValue placeholder="Merek" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Merek</SelectItem>
                {brands.map((brand) => (
                  <SelectItem key={brand} value={brand}>
                    {brand}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
              onClick={onResetFilter}
            >
              <RotateCcw className="size-3.5" />
              Reset Filter
            </Button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-end lg:self-auto shrink-0 pt-1 lg:pt-0">
          {userRole === "admin" && selectedCount > 0 && (
            <Button variant="destructive" size="sm" className="h-9 gap-1.5 text-xs" onClick={onBulkDelete}>
              <Trash2 className="size-3.5" />
              Hapus ({selectedCount})
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={onExportExcel}
            disabled={!hasFilteredData}
          >
            <Download className="size-3.5" />
            <span>Export Excel</span>
          </Button>
          {userRole === "admin" && (
            <Button
              size="sm"
              className="h-9 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm"
              asChild
            >
              <Link to="/barang-masuk">
                <Plus className="size-3.5" />
                <span>Tambah Unit</span>
              </Link>
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
