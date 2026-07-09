"use client"

import * as React from "react"
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
    type ColumnDef,
    type Table as TanstackTable,
} from "@tanstack/react-table"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
    IconPackage,
    IconLoader,
    IconDotsVertical,
    IconCircleCheck,
    IconX,
    IconBan,
    IconGripVertical,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useNavigate } from "react-router-dom"
import { useSortable } from "@dnd-kit/sortable"
import type { DashboardRequest } from "@/types/transaction"

/** Meta yang dapat diakses oleh kolom tabel. Bukan `any` — fully typed. */
export type TableMeta = {
    onRowClick?: (item: DashboardRequest) => void
    onStatusChange?: (id: string, status: string) => void
}

export type DataTableProps = {
    data: DashboardRequest[]
    className?: string
    onRowClick?: (item: DashboardRequest) => void
    onStatusChange?: (id: string, status: string) => void
    /** ID kolom yang ingin disembunyikan. Contoh: ["requestItems"] */
    hiddenColumns?: string[]
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

type StatusKey = "Menunggu" | "Disetujui" | "Siap" | "Selesai" | "Ditolak" | "Dibatalkan"

const STATUS_CONFIG: Record<StatusKey, { icon: typeof IconLoader; dotClass: string }> = {
    Menunggu: { icon: IconLoader, dotClass: "bg-gray-500 dark:bg-gray-400" },
    Disetujui: { icon: IconCircleCheck, dotClass: "bg-green-500 dark:bg-green-400" },
    Siap: { icon: IconPackage, dotClass: "bg-yellow-500 dark:bg-yellow-400" },
    Selesai: { icon: IconCircleCheck, dotClass: "bg-green-500 dark:bg-green-400" },
    Ditolak: { icon: IconX, dotClass: "bg-red-500 dark:bg-red-400" },
    Dibatalkan: { icon: IconBan, dotClass: "text-gray-500 border-gray-300 bg-gray-50" },
}

const DEFAULT_STATUS_CONFIG = { icon: IconLoader, dotClass: "text-muted-foreground" }

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function DragHandle({ id }: { id: string }) {
    const { attributes, listeners } = useSortable({ id })
    return (
        <Button
            {...attributes}
            {...listeners}
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:bg-transparent"
        >
            <IconGripVertical className="size-3 text-muted-foreground" />
            <span className="sr-only">Drag to reorder</span>
        </Button>
    )
}

function StatusBadge({ status }: { status: string }) {
    const key = status?.trim() as StatusKey
    const config = STATUS_CONFIG[key] ?? DEFAULT_STATUS_CONFIG
    return (
        <Badge variant="outline" className="flex items-center px-1.5 py-2.5 text-muted-foreground">
            <span className={cn(config.dotClass, "size-2 rounded-full")} />
            <span>{status}</span>
        </Badge>
    )
}

function ActionMenu({
    row,
    table,
}: {
    row: { original: DashboardRequest }
    table: TanstackTable<DashboardRequest>
}) {
    const status = row.original.status?.toUpperCase()?.trim()
    const meta = table.options.meta as TableMeta | undefined

    const handleStatusChange = React.useCallback(
        (e: React.MouseEvent, newStatus: string) => {
            e.stopPropagation()
            meta?.onStatusChange?.(row.original.id, newStatus)
        },
        [meta, row.original.id]
    )

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className="flex size-8 cursor-pointer text-muted-foreground data-[state=open]:bg-muted"
                    size="icon"
                    onClick={(e) => e.stopPropagation()}
                >
                    <IconDotsVertical />
                    <span className="sr-only">Open menu</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
                <DropdownMenuItem className="cursor-pointer">Detail</DropdownMenuItem>

                {status === "DISETUJUI" && (
                    <>
                        <DropdownMenuItem className="cursor-pointer">Siapkan</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="cursor-pointer"
                            variant="destructive"
                            onClick={(e) => handleStatusChange(e, "Dibatalkan")}
                        >
                            Batalkan
                        </DropdownMenuItem>
                    </>
                )}

                {status === "SIAP" && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="cursor-pointer"
                            variant="destructive"
                            onClick={(e) => handleStatusChange(e, "Dibatalkan")}
                        >
                            Batalkan
                        </DropdownMenuItem>
                    </>
                )}

                {status !== "DISETUJUI" && status !== "SIAP" && (
                    <>
                        <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={(e) => handleStatusChange(e, "Disetujui")}
                        >
                            Setujui
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="cursor-pointer"
                            variant="destructive"
                            onClick={(e) => handleStatusChange(e, "Ditolak")}
                        >
                            Tolak
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

// ─────────────────────────────────────────────
// Column Definitions (factory function agar columns tidak berisi closure meta)
// ─────────────────────────────────────────────

function createColumns(meta?: TableMeta): ColumnDef<DashboardRequest>[] {
    return [
        {
            id: "nomor",
            header: "No.",
            cell: ({ row }) => (
                <div className="text-muted-foreground whitespace-nowrap">{row.index + 1}</div>
            ),
        },
        {
            accessorKey: "requestNumber",
            header: "No. Permintaan",
            cell: ({ row }) => (
                <div className="font-medium text-primary">{row.original.requestNumber}</div>
            ),
        },
        {
            accessorKey: "requestedAt",
            header: "Tanggal Permintaan",
            cell: ({ row }) => (
                <div className="text-muted-foreground whitespace-nowrap">
                    {new Date(row.original.requestedAt).toLocaleDateString("id-ID", DATE_FORMAT_OPTIONS)}
                </div>
            ),
        },
        {
            accessorKey: "partner",
            header: "Pemohon",
            cell: ({ row }) => (
                <div className="text-foreground font-medium">{row.original.partner}</div>
            ),
        },
        {
            accessorKey: "partnerCategory",
            header: "Kategori",
            cell: ({ row }) => (
                <Badge variant="outline" className="flex items-center text-muted-foreground whitespace-nowrap px-2 py-2.5">
                    {row.original.partnerCategory}
                </Badge>
            ),
        },
        {
            accessorKey: "itemTotal",
            header: () => <div className="text-center">Jumlah</div>,
            cell: ({ row }) => (
                <div className="text-muted-foreground whitespace-nowrap text-center">
                    {row.original.itemTotal}
                </div>
            ),
        },
        {
            accessorKey: "requestItems",
            header: () => <div className="text-center">Detail Material</div>,
            cell: ({ row, table }) => (
                <div className="text-muted-foreground whitespace-nowrap text-center">
                    <Button
                        variant="outline"
                        size="sm"
                        className="cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation()
                            const tableMeta = table.options.meta as TableMeta | undefined
                            tableMeta?.onRowClick?.(row.original)
                        }}
                    >
                        Lihat Detail
                    </Button>
                </div>
            ),
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => <StatusBadge status={row.original.status} />,
        },
        {
            id: "actions",
            header: "Aksi",
            cell: ({ row, table }) => <ActionMenu row={row} table={table} />,
        },
    ]
}

// ─────────────────────────────────────────────
// DataTable component
// ─────────────────────────────────────────────

export function DataTable({ data, className, onRowClick, onStatusChange, hiddenColumns = [] }: DataTableProps) {
    const navigate = useNavigate()

    const tableMeta: TableMeta = React.useMemo(
        () => ({ onRowClick, onStatusChange }),
        [onRowClick, onStatusChange]
    )

    const columns = React.useMemo(() => createColumns(tableMeta), [])

    const columnVisibility = React.useMemo(
        () => Object.fromEntries(hiddenColumns.map((col) => [col, false])),
        [hiddenColumns]
    )

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        meta: tableMeta,
        initialState: { columnVisibility },
    })

    return (
        <div className={cn("flex flex-col w-full h-full min-h-0", className)}>
            <div className="overflow-auto rounded-lg border flex-1 min-h-0 relative max-h-[400px] lg:max-h-none">
                <Table>
                    <TableHeader className="sticky top-0 z-20 bg-muted shadow-sm">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="hover:bg-transparent">
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id}>
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.length > 0 ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    className="cursor-pointer transition-colors hover:bg-muted/40"
                                    onClick={() => navigate(`/riwayat/${row.original.id}`)}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center text-muted-foreground bg-muted/10"
                                >
                                    Belum ada daftar permintaan.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
