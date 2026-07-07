"use client"

import * as React from "react"
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
    type ColumnDef,
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
import { IconPackage, IconNotes, IconLoader, IconChevronRight, IconDotsVertical } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Button } from "./ui/button"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "./ui/dropdown-menu"
import { Check, X } from "lucide-react"

export type RequestItem = {
    id: number;
    category: string;
    brand: string;
    quantity: number;
};

export type DashboardRequest = {
    id: string;
    requestNumber: string;
    partner: string;
    status: string;
    notes: string;
    requestedAt: string;
    requestItems: RequestItem[];
};

export const columns: ColumnDef<DashboardRequest>[] = [
    {
        id: "nomor",
        header: "No.",
        cell: ({ row }) => (
            <div className="text-muted-foreground whitespace-nowrap">
                {row.index + 1}
            </div>
        ),
    },
    {
        accessorKey: "requestNumber",
        header: "No. Permintaan",
        cell: ({ row }) => (
            <div className="font-medium text-primary">
                {row.original.requestNumber}
            </div>
        ),
    },
    {
        accessorKey: "requestedAt",
        header: "Tanggal Permintaan",
        cell: ({ row }) => (
            <div className="text-muted-foreground whitespace-nowrap">
                {new Date(row.original.requestedAt).toLocaleDateString("id-ID", {
                    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                })}
            </div>
        ),
    },
    {
        accessorKey: "partner",
        header: "Pemohon",
        cell: ({ row }) => (
            <div className="text-foreground font-medium">
                {row.original.partner}
            </div>
        ),
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.original.status;
            let colorClass = "bg-muted-foreground text-muted-foreground";

            switch (status) {
                case "MENUNGGU": colorClass = "bg-amber-500/10 text-amber-600 border-amber-500/20"; break;
                case "DISETUJUI": colorClass = "bg-blue-500/10 text-blue-600 border-blue-500/20"; break;
                case "DIPROSES": colorClass = "bg-purple-500/10 text-purple-600 border-purple-500/20"; break;
                case "DIKIRIM": colorClass = "bg-sky-500/10 text-sky-600 border-sky-500/20"; break;
                case "DITERIMA":
                case "SELESAI": colorClass = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"; break;
                case "DITOLAK":
                case "DIBATALKAN": colorClass = "bg-rose-500/10 text-rose-600 border-rose-500/20"; break;
            }

            return (
                <Badge variant="outline" className={`font-normal text-muted-foreground px-2.5 py-0.5`}>
                    <IconLoader />
                    {status}
                </Badge>
            )
        },
    },
    {
        id: "actions",
        header: "Action",
        cell: () => (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        className="flex size-8 text-muted-foreground data-[state=open]:bg-muted"
                        size="icon"
                    >
                        <IconDotsVertical />
                        <span className="sr-only">Open menu</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                    <DropdownMenuItem>Detail</DropdownMenuItem>
                    <DropdownMenuItem>Approve</DropdownMenuItem>
                    <DropdownMenuItem variant="destructive">Reject</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        ),
    },
]

export function DataTable({
    data, className, onRowClick
}: {
    data: DashboardRequest[], className?: string, onRowClick?: (item: DashboardRequest) => void
}) {
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    })

    return (
        <div className={cn("flex flex-col w-full h-full animate-fade-in min-h-0", className)}>
            <div className="overflow-auto rounded-lg border shadow-sm flex-1 min-h-0 relative max-h-[400px] lg:max-h-none">
                <Table>
                    <TableHeader className="sticky top-0 z-20 bg-muted shadow-sm">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="hover:bg-transparent">
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    className={cn("transition-colors hover:bg-muted/40", onRowClick && "cursor-pointer")}
                                    onClick={() => onRowClick?.(row.original)}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="">
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
                                    <div className="flex flex-col items-center justify-center gap-1">
                                        <span>Belum ada daftar permintaan.</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
