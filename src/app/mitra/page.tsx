"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Edit,
  MoreVertical,
  Plus,
  Power,
  Search,
  Trash2,
  Users,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

/**
 * Helper: Mengembalikan Base URL untuk pemanggilan API.
 * 
 * @returns {string} String URL API Backend.
 */
const getBaseUrl = () => {
  const baseUrl = import.meta.env.URL || import.meta.env.VITE_URL;
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
};

/**
 * Helper: Menyusun header HTTP secara otomatis beserta Authorization token.
 * 
 * @returns {Record<string, string>} Object header HTTP.
 */
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

import type { PartnerType, Partner } from "@/types/partner"

const PARTNER_TYPES: PartnerType[] = ["AKTIVASI", "GANGGUAN"]
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const
const normalizeIdentityCode = (value: string) => value.trim().toUpperCase()

const slugifyName = (name: string) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function EmptyMitraTableState({ isFiltered }: { isFiltered: boolean }) {
  return (
    <div className="flex min-h-75 items-center justify-center px-6 py-12">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
          {isFiltered ? (
            <Search className="size-7" strokeWidth={1.8} />
          ) : (
            <Building2 className="size-7" strokeWidth={1.8} />
          )}
        </div>
        <div className="space-y-1.5">
          <p className="text-base font-semibold text-foreground">
            {isFiltered ? "Tidak ada mitra yang cocok" : "Belum ada data mitra"}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isFiltered
              ? "Coba ubah kata kunci pencarian atau filter yang sedang aktif."
              : "Data mitra akan tampil di sini setelah Anda menambahkan mitra baru."}
          </p>
        </div>
      </div>
    </div>
  )
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell className="text-center"><Skeleton className="mx-auto h-4 w-6" /></TableCell>
          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-36" /></TableCell>
          <TableCell className="text-center"><Skeleton className="mx-auto h-5 w-16" /></TableCell>
          <TableCell><Skeleton className="ml-auto h-7 w-7" /></TableCell>
        </TableRow>
      ))}
    </>
  )
}

const initialForm = {
  code: "",
  name: "",
  partnerType: "AKTIVASI" as PartnerType,
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  isActive: true,
  username: "",
  password: "",
  confirmPassword: "",
}

/**
 * Komponen MitraPage
 * 
 * Halaman untuk mengelola data akun pengguna dengan role MITRA.
 * Merupakan perpaduan antara manajemen identitas profil entitas bisnis 
 * sekaligus manajemen kredensial login.
 * 
 * @returns {JSX.Element} Antarmuka halaman manajemen mitra.
 */
export default function MitraPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formData, setFormData] = useState(initialForm)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [deleteTarget, setDeleteTarget] = useState<Partner | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0])
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  /**
   * Mengambil data seluruh pengguna (role: MITRA) dari backend.
   * Melakukan pemetaan struktur objek dari backend agar sesuai dengan 
   * interface Partner yang digunakan tabel di frontend.
   */
  const loadPartners = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${getBaseUrl()}/users`, {
        method: "GET",
        headers: getHeaders(),
      })
      if (!response.ok) {
        throw new Error("Gagal memuat data mitra")
      }
      const data = await response.json()

      // Standarisasi field user & profile
      const usersList = data.data || data.users || data
      const partnersList: Partner[] = (Array.isArray(usersList) ? usersList : []).filter((u: any) => u.role === "MITRA").map((u: any) => ({
        id: String(u.id),
        code: u.profile?.code || u.code || "-",
        name: u.profile?.nama || u.profile?.name || u.name || u.username || "",
        partnerType: (u.profile?.partnerType || u.partnerType || "Supplier") as PartnerType,
        contactPerson: u.profile?.contactPerson || u.contactPerson || "-",
        phone: u.profile?.telepon || u.profile?.phone || u.phone || "-",
        email: u.profile?.email || u.email || "-",
        address: u.profile?.alamat || u.profile?.address || u.address || "-",
        isActive: u.isAktif !== undefined ? u.isAktif : (u.isActive !== undefined ? u.isActive : true),
        username: u.username || null,
      }))
      setPartners(partnersList)
    } catch (error) {
      console.error("Gagal memuat data mitra:", error)
      toast.error("Gagal memuat data mitra.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPartners()
  }, [])

  const hasActiveFilter = searchQuery.trim() !== "" || typeFilter !== "all" || statusFilter !== "all"

  /**
   * Memoization hasil filtering.
   * Melakukan filter ganda: Pencarian teks (multi-kolom) + Filter Dropdown (Jenis & Status).
   */
  const filteredPartners = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return partners.filter((partner) => {
      // Fitur multi-search
      const matchesSearch =
        !query ||
        partner.code?.toLowerCase().includes(query) ||
        partner.name.toLowerCase().includes(query) ||
        partner.contactPerson?.toLowerCase().includes(query) ||
        partner.phone?.toLowerCase().includes(query) ||
        partner.email?.toLowerCase().includes(query) ||
        partner.address?.toLowerCase().includes(query) ||
        partner.username?.toLowerCase().includes(query)
      const matchesType =
        typeFilter === "all" || partner.partnerType === typeFilter
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? partner.isActive : !partner.isActive)

      return matchesSearch && matchesType && matchesStatus
    })
  }, [partners, searchQuery, statusFilter, typeFilter])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredPartners.length / pageSize))
  const paginatedPartners = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredPartners.slice(start, start + pageSize)
  }, [filteredPartners, currentPage, pageSize])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, typeFilter, statusFilter, pageSize])

  const openAddModal = () => {
    setEditId(null)
    setFormData(initialForm)
    setFormErrors({})
    setIsModalOpen(true)
  }

  const openEditModal = (partner: Partner) => {
    setEditId(partner.id)
    setFormData({
      code: partner.code || "",
      name: partner.name,
      partnerType: partner.partnerType || "AKTIVASI",
      contactPerson: partner.contactPerson || "",
      phone: partner.phone || "",
      email: partner.email || "",
      address: partner.address || "",
      isActive: partner.isActive,
      username: partner.username || "",
      password: "",
      confirmPassword: "",
    })
    setFormErrors({})
    setIsModalOpen(true)
  }

  /**
   * Menyimpan data mitra ke API Backend.
   * Jika sukses, secara implisit backend akan membuat kredensial login (user account)
   * selain profil mitranya.
   */
  const handleSave = async () => {
    if (isSaving) return
    const errors: Record<string, string> = {}
    const normalizedName = formData.name.trim()
    const normalizedEmail = formData.email.trim()
    const normalizedUsername = formData.username.trim()
    const normalizedCode = normalizeIdentityCode(formData.code)

    if (
      normalizedCode.length < 2 ||
      normalizedCode.length > 30 ||
      !/^[A-Z0-9_-]+$/.test(normalizedCode)
    ) {
      errors.code =
        "Kode harus 2-30 karakter dan hanya berisi huruf, angka, - atau _."
    }
    if (!normalizedName) {
      errors.name = "Nama mitra wajib diisi."
    }

    // Validasi duplikasi Nama Mitra
    const hasDuplicateName = partners.some(
      (partner) =>
        partner.name.trim().toLowerCase() === normalizedName.toLowerCase() &&
        partner.id !== editId
    )
    if (hasDuplicateName) {
      errors.name = "Nama mitra sudah terdaftar."
    }

    // Auto-generate unique username for new partner
    let finalUsername = normalizedUsername;
    if (!editId) {
      if (!finalUsername) {
        finalUsername = slugifyName(normalizedName);
      }
      let counter = 1;
      let baseUsername = finalUsername;
      while (partners.some(p => p.username?.trim().toLowerCase() === finalUsername.toLowerCase())) {
        finalUsername = `${baseUsername}${counter}`;
        counter++;
      }

      // Ensure minimum 4 characters for backend
      if (finalUsername.length < 4) {
        finalUsername = finalUsername.padEnd(4, '0')
      }
    } else {
      // Validasi duplikasi Username login untuk edit
      const hasDuplicateUsername = partners.some(
        (partner) =>
          partner.username?.trim().toLowerCase() ===
          finalUsername.toLowerCase() && partner.id !== editId
      )

    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      toast.error("Periksa kembali data mitra.")
      return
    }

    setIsSaving(true)
    try {
      if (editId) {
        const bodyData: any = {
          name: normalizedName,
          code: normalizedCode,
          partnerType: formData.partnerType,
          contactPerson: formData.contactPerson.trim() || "-",
          phone: formData.phone.trim() || "-",
          email: normalizedEmail || "-",
          address: formData.address.trim() || "-",
          isActive: formData.isActive,
          username: finalUsername,
          role: "MITRA",
        }
        if (formData.password) {
          bodyData.password = formData.password
        }

        const response = await fetch(`${getBaseUrl()}/users/${editId}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify(bodyData),
        })

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.message || errData.error || "Gagal memperbarui data mitra.")
        }
      } else {
        const response = await fetch(`${getBaseUrl()}/users`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            name: normalizedName,
            code: normalizedCode,
            partnerType: formData.partnerType,
            contactPerson: formData.contactPerson.trim() || "-",
            phone: formData.phone.trim() || "-",
            email: normalizedEmail || "-",
            address: formData.address.trim() || "-",
            isActive: formData.isActive,
            username: finalUsername,
            password: "Taslim123!",
            role: "MITRA",
          }),
        })

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.message || errData.error || "Gagal menambahkan mitra baru.")
        }
      }
      await loadPartners()
      setIsModalOpen(false)
      toast.success(
        editId ? "Data mitra berhasil diperbarui." : "Mitra baru berhasil ditambahkan."
      )
    } catch (error: any) {
      console.error("Gagal menyimpan data mitra:", error)
      toast.error(
        error.message || (typeof error === "string" ? error : "Gagal menyimpan data mitra.")
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleStatus = async (partner: Partner) => {
    if (togglingId === partner.id) return
    setTogglingId(partner.id)
    try {
      const response = await fetch(`${getBaseUrl()}/users/${partner.id}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({
          isActive: !partner.isActive,
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.message || errData.error || "Gagal mengubah status mitra.")
      }

      await loadPartners()
      toast.success(
        `Mitra berhasil ${partner.isActive ? "dinonaktifkan" : "diaktifkan"}.`
      )
    } catch (error: any) {
      console.error("Gagal mengubah status mitra:", error)
      toast.error(error.message || "Gagal mengubah status mitra.")
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget || isDeleting) return
    setIsDeleting(true)

    try {
      const response = await fetch(`${getBaseUrl()}/users/${deleteTarget.id}`, {
        method: "DELETE",
        headers: getHeaders(),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.message || errData.error || "Gagal menghapus mitra.")
      }

      await loadPartners()
      setDeleteTarget(null)
      toast.success("Mitra berhasil dihapus.")
    } catch (error: any) {
      console.error("Gagal menghapus mitra:", error)
      toast.error(error.message || "Gagal menghapus mitra.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6 lg:p-8">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Cari mitra, PIC, telepon..."
              className="pl-9 rounded-sm"
            />
          </div>
          <div className="flex gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className={`w-26 rounded-sm ${typeFilter === 'all' ? 'border-dashed' : ''}`}>
                <SelectValue placeholder="Jenis mitra" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Jenis</SelectItem>
                {PARTNER_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className={`w-26 rounded-sm ${statusFilter === 'all' ? 'border-dashed' : ''}`}>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="inactive">Nonaktif</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={openAddModal} className="gap-2">
          <Plus className="size-4" />
          Tambah Mitra
        </Button>
      </div>

      {/* Data Table */}
      <div className="min-h-0 flex-1 rounded-lg border bg-card/20 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            <TableRow>
              <TableHead className="w-12.5 text-center">No.</TableHead>
              <TableHead className="w-45">Nama Mitra</TableHead>
              <TableHead className="w-25">Kode</TableHead>
              <TableHead className="w-27.5">Jenis</TableHead>
              <TableHead className="w-37.5">PIC</TableHead>
              <TableHead className="w-35">Telepon</TableHead>
              <TableHead className="hidden lg:table-cell w-45">Wilayah</TableHead>
              <TableHead className="w-25 text-center">Status</TableHead>
              <TableHead className="w-12.5 text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton />
            ) : paginatedPartners.length > 0 ? (
              paginatedPartners.map((partner, index) => (
                <TableRow
                  key={partner.id}
                  className="hover:bg-muted/30 transition-colors"
                >
                  <TableCell className="text-center font-medium">
                    {(currentPage - 1) * pageSize + index + 1}
                  </TableCell>
                  <TableCell>
                    <span className="block max-w-40 truncate font-medium">{partner.name}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">{partner.code}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">{partner.partnerType === "AKTIVASI" ? "Aktivasi" : "Gangguan"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="block max-w-[130px] truncate">{partner.contactPerson}</span>
                  </TableCell>
                  <TableCell>
                    <span className="block max-w-[130px] truncate">{partner.phone}</span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="block max-w-[160px] truncate text-muted-foreground">{partner.address}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="secondary"
                      className="font-normal gap-1.5 px-2.5 py-0.5"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${partner.isActive
                        ? "bg-emerald-500"
                        : "bg-muted-foreground/50"
                        }`} />
                      {partner.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-xs" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                          <MoreVertical className="size-4" />
                          <span className="sr-only">Menu mitra</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[160px]">
                        <DropdownMenuItem onClick={() => openEditModal(partner)}>
                          <Edit className="size-4 mr-2" />
                          <span>Edit Mitra</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={togglingId === partner.id} onClick={() => handleToggleStatus(partner)}>
                          {togglingId === partner.id ? (
                            <Loader2 className="size-4 mr-2 animate-spin" />
                          ) : (
                            <Power className="size-4 mr-2" />
                          )}
                          {partner.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteTarget(partner)}
                        >
                          <Trash2 className="size-4 mr-2" />
                          <span>Hapus Mitra</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="p-0">
                  <EmptyMitraTableState isFiltered={hasActiveFilter} />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!isLoading && filteredPartners.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Tampilkan</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => setPageSize(Number(v))}
            >
              <SelectTrigger className="h-7 w-[70px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>per halaman</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Halaman {currentPage} dari {totalPages}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="size-4" />
                <span className="sr-only">Halaman sebelumnya</span>
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                <ChevronRight className="size-4" />
                <span className="sr-only">Halaman selanjutnya</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="flex flex-col sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Mitra" : "Tambah Mitra"}</DialogTitle>
            <DialogDescription>
              Kelola identitas mitra sekaligus akun yang digunakan untuk login.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="partner-name">Nama Mitra</Label>
                <Input
                  id="partner-name"
                  value={formData.name}
                  onChange={(event) => {
                    const newName = event.target.value
                    setFormData((current) => {
                      return { ...current, name: newName }
                    })
                    setFormErrors((current) => ({ ...current, name: "" }))
                  }}
                  placeholder="Contoh: PT Telkom Indonesia"
                  className={formErrors.name ? "border-destructive" : ""}
                />
                {formErrors.name && (
                  <p className="text-xs text-destructive">{formErrors.name}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner-code">Kode Mitra</Label>
                <Input
                  id="partner-code"
                  value={formData.code}
                  onChange={(event) => {
                    setFormData((current) => ({
                      ...current,
                      code: event.target.value.toUpperCase(),
                    }))
                    setFormErrors((current) => ({ ...current, code: "" }))
                  }}
                  placeholder="Contoh: MTR-001"
                  className={`${formErrors.code ? "border-destructive" : ""}`}
                />
                {formErrors.code && (
                  <p className="text-xs text-destructive">{formErrors.code}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jenis Mitra</Label>
                <Select
                  value={formData.partnerType}
                  onValueChange={(value) =>
                    setFormData((current) => ({
                      ...current,
                      partnerType: value as PartnerType,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTNER_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.isActive ? "active" : "inactive"}
                  onValueChange={(value) =>
                    setFormData((current) => ({
                      ...current,
                      isActive: value === "active",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="inactive">Nonaktif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact-person">Penanggung Jawab / PIC</Label>
                <Input
                  id="contact-person"
                  value={formData.contactPerson}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      contactPerson: event.target.value,
                    }))
                  }
                  placeholder="Nama kontak utama"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner-phone">Telepon</Label>
                <Input
                  id="partner-phone"
                  value={formData.phone}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, phone: event.target.value }))
                  }
                  placeholder="08xxxxxxxxxx"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="partner-address">Wilayah</Label>
              <Input
                id="partner-address"
                value={formData.address}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, address: event.target.value }))
                }
                placeholder="Wilayah kerja mitra"
              />
            </div>


          </div>
          <DialogFooter className="flex flex-row pr-4">
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSaving}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && !isDeleting && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus mitra?</AlertDialogTitle>
            <AlertDialogDescription>
              Data {deleteTarget?.name} akan dihapus permanen dari database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
