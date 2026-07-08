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
import { IconPackage, IconNotes, IconLoader, IconChevronRight, IconDotsVertical, IconCircleCheck, IconCheck, IconX, IconBan } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"


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

            const statusConfig: Record<
                string,
                { icon: typeof IconLoader; className: string }
            > = {
                MENUNGGU: {
                    icon: IconLoader,
                    className: "bg-gray-500 dark:bg-gray-400",
                },
                DISETUJUI: {
                    icon: IconCircleCheck,
                    className: "bg-green-500 dark:bg-green-400",
                },
                SIAP: {
                    icon: IconPackage,
                    className: "bg-yellow-500 dark:bg-yellow-400",
                },
                SELESAI: {
                    icon: IconCircleCheck,
                    className: "bg-green-500 dark:bg-green-400",
                },
                DITOLAK: {
                    icon: IconX,
                    className: "bg-red-500 dark:bg-red-400",
                },
                DIBATALKAN: {
                    icon: IconBan,
                    className: "text-gray-500 border-gray-300 bg-gray-50",
                },
            };

            const normalizedStatus = status?.toUpperCase()?.trim() || "";
            const config = statusConfig[normalizedStatus] ?? {
                icon: IconLoader,
                className: "text-muted-foreground",
            };
            const IconStatus = config.icon;
            const className = config.className;

            return (
                <Badge
                    variant="outline"
                    className="flex items-center px-1.5 py-2.5 text-muted-foreground"
                >
                    <span className={cn(className, "size-2 rounded-full")}></span>
                    <span>{status}</span>
                </Badge>
            );
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
                        onClick={(e) => e.stopPropagation()}
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
