"use client"

import * as React from "react"
import {
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
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
    IconCircleCheck,
    IconX,
    IconBan,
    IconFileText,
    IconChevronsLeft,
    IconChevronLeft,
    IconChevronRight,
    IconChevronsRight,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { getBaseUrl } from "@/lib/api"
import { openUrl } from "@tauri-apps/plugin-opener"
import { useNavigate } from "react-router-dom"
import type { DashboardRequest } from "@/types/transaction"
import { PackageCheck, ArrowUpDown, Check, Edit } from "lucide-react"
import { PengambilanQrModal } from "./PengambilanQrModal"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

function ScrollShadowWrapper({ children, className }: { children: React.ReactNode, className?: string }) {
    const [canScrollTop, setCanScrollTop] = React.useState(false)
    const [canScrollBottom, setCanScrollBottom] = React.useState(false)
    const [headerHeight, setHeaderHeight] = React.useState(40)
    const scrollRef = React.useRef<HTMLDivElement>(null)

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

    React.useEffect(() => {
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
        <div className={cn("rounded-lg border overflow-hidden relative flex-1 min-h-0", className)}>
            <div
                ref={scrollRef}
                className="overflow-auto h-full max-h-[65vh] lg:max-h-none overscroll-contain [&>div]:overflow-visible [&>div]:static"
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
    Menunggu: {
        icon: IconLoader, dotClass: "text-muted-foreground bg-neutral-500/20 border-0"
    },
    Disetujui: { icon: IconCircleCheck, dotClass: "dark:text-green-600/80 dark:bg-green-300/10 border-0 text-emerald-700 bg-emerald-100/80" },
    Siap: { icon: IconPackage, dotClass: "text-amber-600 bg-amber-700/10 dark:border-amber-500/10 dark:border-1 border-0" },
    Selesai: { icon: IconCircleCheck, dotClass: "text-emerald-600/80 bg-emerald-700/10 dark:border-emerald-500/10 border-emerald-500/10" },
    Ditolak: { icon: IconX, dotClass: "text-destructive bg-red-400/10 border-0" },
    Dibatalkan: { icon: IconBan, dotClass: "text-destructive bg-red-400/10 border-0" },
}

const DEFAULT_STATUS_CONFIG = { icon: IconLoader, dotClass: "bg-muted-foreground" }

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
    const safeStatus = status?.trim() || ""
    const formattedStatus = safeStatus.charAt(0).toUpperCase() + safeStatus.slice(1).toLowerCase()
    const key = formattedStatus as StatusKey
    const config = STATUS_CONFIG[key] ?? DEFAULT_STATUS_CONFIG

    return (
        <Badge variant="outline" className={cn("flex items-center gap-1 px-2 py-2.5", config.dotClass)}>
            {/* <span className={cn(config.dotClass, "size-2 rounded-full")} /> */}
            <span>{formattedStatus}</span>
        </Badge>
    )
}

function BastActions({
    row,
    table,
}: {
    row: { original: DashboardRequest }
    table: TanstackTable<DashboardRequest>
}) {
    const status = row.original.status?.toUpperCase()?.trim()
    const meta = table.options.meta as TableMeta | undefined
    const [pengambilanModalOpen, setPengambilanModalOpen] = React.useState(false)

    const handleOpenDraftPDF = React.useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation()
        try {
            const token = localStorage.getItem("arxiva-auth-token") || "";
            const url = `${getBaseUrl()}/requests/${row.original.id}/pdf-draft?token=${token}`;
            await openUrl(url);
        } catch (error) {
            toast.error("Gagal membuka PDF BAST Draft");
        }
    }, [row.original.id]);

    const handleOpenSignedPDF = React.useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation()
        try {
            const token = localStorage.getItem("arxiva-auth-token") || "";
            const url = `${getBaseUrl()}/requests/${row.original.id}/pdf-signed?token=${token}`;
            await openUrl(url);
        } catch (error) {
            toast.error("Gagal membuka PDF BAST Final");
        }
    }, [row.original.id]);

    const handleOpenDrive = React.useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation()
        const driveUrl = row.original.deliveryDocument?.driveViewUrl;
        if (driveUrl) {
            await openUrl(driveUrl);
        } else {
            toast.error("Link Google Drive belum tersedia");
        }
    }, [row.original.deliveryDocument?.driveViewUrl]);

    const showBastActions = ["SIAP", "SELESAI", "DITERIMA"].includes(status || "")

    if (!showBastActions) return null;

    const isSigned = ["SELESAI", "DITERIMA"].includes(status || "");

    return (
        <div className="flex items-center justify-center gap-2">
            {!isSigned ? (
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground font-medium cursor-pointer gap-1.5"
                    title="Buka PDF BAST Draft (Tanpa TTD)"
                    onClick={handleOpenDraftPDF}
                >
                    <IconFileText size={16} />
                    BAST Draft
                </Button>
            ) : (
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-medium cursor-pointer gap-1.5 text-muted-foreground"
                    title="Buka PDF BAST Final (Ber-TTD)"
                    onClick={handleOpenSignedPDF}
                >
                    <IconFileText size={16} />
                    Lihat BAST
                </Button>
            )}

            {isSigned && row.original.deliveryDocument?.driveViewUrl && (
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-medium cursor-pointer gap-1.5 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400 border-blue-500/20"
                    title="Buka di Google Drive"
                    onClick={handleOpenDrive}
                >
                    Google Drive
                </Button>
            )}

            {status === "SIAP" && (
                <>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs font-medium cursor-pointer gap-1.5 bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 dark:bg-sky-500/20 dark:text-sky-400 border-sky-500/20"
                        title="Pengambilan Material BAST"
                        onClick={(e) => {
                            e.stopPropagation();
                            setPengambilanModalOpen(true);
                        }}
                    >
                        <PackageCheck size={16} />
                        Pengambilan
                    </Button>
                    <PengambilanQrModal
                        isOpen={pengambilanModalOpen}
                        onOpenChange={setPengambilanModalOpen}
                        request={row.original}
                        onSuccess={() => {
                            meta?.onStatusChange?.(row.original.id, "Selesai");
                        }}
                    />
                </>
            )}
        </div>
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

    const navigate = useNavigate()

    const handleStatusChange = React.useCallback(
        (e: React.MouseEvent, newStatus: string) => {
            e.stopPropagation()
            meta?.onStatusChange?.(row.original.id, newStatus)
        },
        [meta, row.original.id]
    )

    const handleNavigateToPrepare = React.useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation()
            navigate(`/request/${row.original.id}/prepare`)
        },
        [navigate, row.original.id]
    )

    return (
        <div className="flex items-center gap-1 justify-center">
            {status === "DISETUJUI" && (
                <>
                    <Button
                        variant="ghost"
                        size="icon-lg"
                        className="text-xs font-medium text-muted-foreground hover:text-amber-600 cursor-pointer"
                        onClick={handleNavigateToPrepare}
                    >
                        <IconPackage size={18} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-lg"
                        className="text-xs font-medium text-muted-foreground hover:text-destructive cursor-pointer"
                        onClick={(e) => handleStatusChange(e, "Dibatalkan")}
                    >
                        <IconBan size={18} />
                    </Button>
                </>
            )}

            {status === "MENUNGGU" && (
                <>
                    <Button
                        variant="ghost"
                        size="icon-lg"
                        className="text-xs font-medium text-muted-foreground hover:text-emerald-700 cursor-pointer"
                        onClick={(e) => handleStatusChange(e, "Disetujui")}
                    >
                        <Check size={18} className="" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-lg"
                        className="text-xs font-medium text-muted-foreground hover:text-destructive cursor-pointer"
                        onClick={(e) => handleStatusChange(e, "Ditolak")}
                    >
                        <IconX size={18} className="" />
                    </Button>
                </>
            )}

            {status === "SIAP" && (
                <div>
                    <Button
                        variant="ghost"
                        size="icon-lg"
                        className="text-xs font-medium text-muted-foreground hover:text-blue-600 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Edit strokeWidth={2} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-lg"
                        className="text-xs font-medium text-muted-foreground hover:text-destructive cursor-pointer"
                        onClick={(e) => handleStatusChange(e, "Dibatalkan")}
                    >
                        <IconBan strokeWidth={2} />
                    </Button>
                </div>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────
// Column Definitions (factory function agar columns tidak berisi closure meta)
// ─────────────────────────────────────────────

function createColumns(): ColumnDef<DashboardRequest>[] {
    return [
        {
            id: "nomor",
            header: () => <div className="text-center">No.</div>,
            cell: ({ row }) => (
                <div className="text-muted-foreground whitespace-nowrap text-center px-4">{row.index + 1}</div>
            ),
        },
        {
            accessorKey: "requestNumber",
            header: "No. Permintaan",
            cell: ({ row }) => (
                <div className="font-medium text-primary uppercase">{row.original.requestNumber}</div>
            ),
        },
        {
            accessorKey: "requestedAt",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="p-0 hover:bg-transparent font-medium"
                    >
                        Tanggal Permintaan
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            cell: ({ row }) => (
                <div className="text-muted-foreground whitespace-nowrap">
                    {new Date(row.original.requestedAt).toLocaleDateString("en-GB", DATE_FORMAT_OPTIONS)}
                </div>
            ),
        },
        {
            accessorKey: "requesterName",
            header: "Mitra",
            cell: ({ row }) => (
                <div className="text-foreground font-medium">{row.original.requesterName}</div>
            ),
        },
        {
            accessorKey: "partnerCategory",
            header: "Kategori",
            cell: ({ row }) => (
                <Badge variant="outline" className="flex items-center text-muted-foreground whitespace-nowrap px-2 py-2.5 capitalize">
                    {row.original.partnerCategory?.toLocaleLowerCase()}
                </Badge>
            ),
        },
        {
            accessorKey: "itemsCount",
            header: () => <div className="text-center">Jumlah</div>,
            cell: ({ row }) => (
                <div className="text-muted-foreground whitespace-nowrap text-center">
                    {row.original.itemsCount}
                </div>
            ),
        },
        {
            accessorKey: "status",
            header: () => <div className="text-center">Status</div>,
            cell: ({ row }) => <div className="flex items-center justify-center"><StatusBadge status={row.original.status} /></div>,
        },
        {
            accessorKey: "document",
            header: () => <div className="text-center">Dokumen</div>,
            cell: ({ row, table }) => <BastActions row={row} table={table} />,
        },
        {
            id: "actions",
            cell: ({ row, table }) => <div className="flex items-center justify-center"><ActionMenu row={row} table={table} /></div>,
        },
    ]
}

// ─────────────────────────────────────────────
// DataTable component
// ─────────────────────────────────────────────

export function DataTable({ data, className, onRowClick, onStatusChange, hiddenColumns = [] }: DataTableProps) {

    const tableMeta: TableMeta = React.useMemo(
        () => ({ onRowClick, onStatusChange }),
        [onRowClick, onStatusChange]
    )

    const columns = React.useMemo(() => createColumns(), [])

    const columnVisibility = React.useMemo(
        () => Object.fromEntries(hiddenColumns.map((col) => [col, false])),
        [hiddenColumns]
    )

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        meta: tableMeta,
        initialState: { columnVisibility },
    })

    return (
        <div className={cn("flex flex-col w-full h-full min-h-0 gap-4", className)}>
            <ScrollShadowWrapper>
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
                                    onClick={() => onRowClick?.(row.original)}
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
            </ScrollShadowWrapper>

            {/* Pagination Controls */}
            {data.length > 0 && (
                <div className="flex items-center justify-between px-4 pb-2">
                    <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
                        {table.getFilteredSelectedRowModel().rows.length} of{" "}
                        {table.getFilteredRowModel().rows.length} row(s) selected.
                    </div>
                    <div className="flex w-full items-center gap-8 lg:w-fit">
                        <div className="hidden items-center gap-2 lg:flex">
                            <Label htmlFor="rows-per-page" className="text-sm font-medium">
                                Rows per page
                            </Label>
                            <Select
                                value={`${table.getState().pagination.pageSize}`}
                                onValueChange={(value) => {
                                    table.setPageSize(Number(value))
                                }}
                            >
                                <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                                    <SelectValue
                                        placeholder={table.getState().pagination.pageSize}
                                    />
                                </SelectTrigger>
                                <SelectContent side="top">
                                    {[10, 20, 30, 40, 50].map((pageSize) => (
                                        <SelectItem key={pageSize} value={`${pageSize}`}>
                                            {pageSize}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex w-fit items-center justify-center text-sm font-medium">
                            Page {table.getState().pagination.pageIndex + 1} of{" "}
                            {table.getPageCount()}
                        </div>
                        <div className="ml-auto flex items-center gap-2 lg:ml-0">
                            <Button
                                variant="outline"
                                className="hidden h-8 w-8 p-0 lg:flex"
                                onClick={() => table.setPageIndex(0)}
                                disabled={!table.getCanPreviousPage()}
                            >
                                <span className="sr-only">Go to first page</span>
                                <IconChevronsLeft />
                            </Button>
                            <Button
                                variant="outline"
                                className="size-8"
                                size="icon"
                                onClick={() => table.previousPage()}
                                disabled={!table.getCanPreviousPage()}
                            >
                                <span className="sr-only">Go to previous page</span>
                                <IconChevronLeft />
                            </Button>
                            <Button
                                variant="outline"
                                className="size-8"
                                size="icon"
                                onClick={() => table.nextPage()}
                                disabled={!table.getCanNextPage()}
                            >
                                <span className="sr-only">Go to next page</span>
                                <IconChevronRight />
                            </Button>
                            <Button
                                variant="outline"
                                className="hidden size-8 lg:flex"
                                size="icon"
                                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                                disabled={!table.getCanNextPage()}
                            >
                                <span className="sr-only">Go to last page</span>
                                <IconChevronsRight />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
