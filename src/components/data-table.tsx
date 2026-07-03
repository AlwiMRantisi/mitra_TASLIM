"use client"

import * as React from "react"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  IconDotsVertical,
  IconLayoutColumns,
  IconSearch,
} from "@tabler/icons-react"
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  getExpandedRowModel,
  type ColumnDef,
  type ColumnFiltersState,
  type ExpandedState,
  type Row,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
} from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * Zod schema defining the structure of a row in the data table.
 * Used for validation and type inference across the application.
 */
export const schema = z.object({
  no: z.number().optional(),
  id: z.union([z.string(), z.number()]),
  tanggal: z.string(),
  tanggalDisplay: z.string().optional(),
  waktu: z.string().optional(),
  createdAt: z.string().optional(),
  nomor: z.string(),
  kategori: z.string(),
  status: z.string().default("Selesai"),
  sn: z.string().optional(),
  merek: z.string().optional(),
  asal: z.string().optional(),
  tujuan: z.string().optional(),
  mitra: z.string().optional(),
  keterangan: z.string().optional(),
})

/**
 * Column definitions for the React Table.
 * Configures headers, cells, accessors, and custom rendering (e.g., badges for status).
 * @type {ColumnDef<z.infer<typeof schema>>[]}
 */
const columns: ColumnDef<z.infer<typeof schema>>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center px-4">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center px-4">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "no",
    header: "No",
    cell: ({ row }) => (
      <div className="text-muted-foreground whitespace-nowrap">
        {row.index + 1}
      </div>
    ),
  },
  {
    accessorKey: "tanggal",
    header: "Tanggal",
    cell: ({ row }) => (
      <div className="text-muted-foreground whitespace-nowrap">
        <div className="font-medium text-foreground">{row.original.tanggalDisplay || row.original.tanggal}</div>
      </div>
    ),
  },
  {
    accessorKey: "nomor",
    header: "ID Transaksi",
    cell: ({ row }) => (
      <div className="font-medium text-primary">
        {row.original.nomor}
      </div>
    ),
  },
  {
    accessorKey: "kategori",
    header: "Kategori",
    cell: ({ row }) => {
      const kat = row.original.kategori;
      let colorClass = "bg-muted-foreground";
      if (kat === "Masuk") colorClass = "bg-emerald-500";
      if (kat === "Keluar") colorClass = "bg-sky-500";
      if (kat === "Rusak") colorClass = "bg-rose-500";

      return (
        <Badge variant="secondary" className="font-normal gap-1.5 px-2.5 py-0.5">
          <div className={`w-1.5 h-1.5 rounded-full ${colorClass}`} />
          {kat}
        </Badge>
      )
    },
  },
  {
    accessorKey: "sn",
    header: "Serial Number",
    cell: ({ row }) => (
      <div className="font-mono text-muted-foreground">
        {row.original.sn || "-"}
      </div>
    ),
  },
  {
    accessorKey: "merek",
    header: "Merek",
    cell: ({ row }) => (
      <div className="text-foreground">
        {row.original.merek || "-"}
      </div>
    ),
  },
  {
    accessorKey: "asal",
    header: "Lokasi Asal",
    cell: ({ row }) => (
      <div className="text-foreground">
        {row.original.asal || "-"}
      </div>
    ),
  },
  {
    accessorKey: "tujuan",
    header: "Lokasi Tujuan",
    cell: ({ row }) => (
      <div className="text-foreground">
        {row.original.tujuan || "-"}
      </div>
    ),
  },
  {
    accessorKey: "keterangan",
    header: "PA / Keterangan",
    cell: ({ row }) => (
      <div className="max-w-60 truncate text-foreground" title={row.original.keterangan}>
        {row.original.keterangan || "-"}
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status || "Selesai";
      let colorClass = "bg-muted-foreground";
      if (status === "Selesai") colorClass = "bg-emerald-500";
      if (status === "Draft") colorClass = "bg-amber-500";
      if (status === "Dibatalkan") colorClass = "bg-rose-500";

      return (
        <Badge variant="secondary" className="font-normal gap-1.5 px-2.5 py-0.5">
          <div className={`w-1.5 h-1.5 rounded-full ${colorClass}`} />
          {status}
        </Badge>
      )
    }
  },
  {
    id: "actions",
    cell: ({ row, table }) => (
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
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              const meta = table.options.meta as { onDeleteRow?: (id: string) => void } | undefined;
              if (meta?.onDeleteRow) {
                meta.onDeleteRow(row.original.id.toString());
              }
            }}
          >
            Hapus
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

/**
 * A wrapper for TableRow that makes it draggable using @dnd-kit.
 * Applies transform and transition styles based on the drag state.
 * 
 * @param {Object} props - Component props.
 * @param {Row<z.infer<typeof schema>>} props.row - The table row instance from tanstack/react-table.
 */
function DraggableRow({ row }: { row: Row<z.infer<typeof schema>> }) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  })

  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      data-dragging={isDragging}
      ref={setNodeRef}
      className={`relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80 cursor-pointer transition-colors`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
        touchAction: "pan-y",
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id} className="py-3">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )
}

/**
 * Renders an empty state for the table when there is no data or no filter results.
 * 
 * @param {Object} props - Component props.
 * @param {boolean} props.isFiltered - Indicates if a filter is currently active (changes the text/icon).
 */
function EmptyTableState({
  isFiltered,
}: {
  isFiltered: boolean
}) {
  return (
    <div className="flex min-h-[260px] items-center justify-center px-6 py-12">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
          {isFiltered ? (
            <IconSearch className="size-7" stroke={1.8} />
          ) : (
            <IconLayoutColumns className="size-7" stroke={1.8} />
          )}
        </div>
        <div className="space-y-1.5">
          <p className="text-base font-semibold text-foreground">
            {isFiltered ? "Tidak ada hasil yang cocok" : "Belum ada data"}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isFiltered
              ? "Coba ubah kata kunci pencarian atau filter yang sedang aktif."
              : "Data akan muncul di tabel ini setelah transaksi ditambahkan."}
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Highly reusable Data Table component featuring sorting, filtering, selection, 
 * pagination, and drag-and-drop row reordering. Built on top of @tanstack/react-table and @dnd-kit.
 *
 * @param {Object} props - The component props.
 * @param {z.infer<typeof schema>[]} props.data - The array of data objects to be displayed.
 * @param {boolean} [props.showTitle] - Whether to show the table title.
 * @param {boolean} [props.showViewButton] - Whether to show the view toggle button.
 * @param {boolean} [props.showSelection=true] - Whether to show the row selection checkboxes.
 * @param {boolean} [props.showActions=true] - Whether to show the actions column (e.g., Delete).
 * @param {boolean} [props.showPagination=true] - Whether to display pagination controls at the bottom.
 * @param {boolean} [props.isFiltered=false] - Whether the parent component is currently filtering data.
 * @param {string} [props.resetPaginationKey] - A key to trigger a reset of pagination to page 1 when changed.
 * @param {(selectedIds: string[]) => void} [props.onSelectionChange] - Callback fired when row selection changes.
 * @param {(id: string) => void} [props.onDeleteRow] - Callback fired when a row's delete action is clicked.
 */
export function DataTable({
  data: initialData,
  showSelection = true,
  showActions = true,
  showPagination = true,
  isFiltered = false,
  resetPaginationKey,
  onSelectionChange,
  onDeleteRow,
}: {
  data: z.infer<typeof schema>[]
  showTitle?: boolean
  showViewButton?: boolean
  showSelection?: boolean
  showActions?: boolean
  showPagination?: boolean
  isFiltered?: boolean
  resetPaginationKey?: string
  onSelectionChange?: (selectedIds: string[]) => void
  onDeleteRow?: (id: string) => void
}) {
  const [data, setData] = React.useState(initialData)

  React.useEffect(() => {
    setData(initialData)
  }, [initialData])
  const [rowSelection, setRowSelection] = React.useState({})

  React.useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(Object.keys(rowSelection))
    }
  }, [rowSelection, onSelectionChange])
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({
      select: showSelection,
      actions: showActions,
    })
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })

  React.useEffect(() => {
    setPagination((current) => ({
      ...current,
      pageIndex: 0,
    }))
  }, [resetPaginationKey])
  const sortableId = React.useId()
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {})
  )

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => data?.map(({ id }) => id) || [],
    [data]
  )

  const [expanded, setExpanded] = React.useState<ExpandedState>({})

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
      expanded,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getExpandedRowModel: getExpandedRowModel(),
    meta: {
      onDeleteRow,
    },
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setData((data) => {
        const oldIndex = dataIds.indexOf(active.id)
        const newIndex = dataIds.indexOf(over.id)
        return arrayMove(data, oldIndex, newIndex)
      })
    }
  }

  return (
    <Tabs
      defaultValue="outline"
      className="w-full flex-col justify-start"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-4 lg:px-6">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Filtering is now handled by the parent component */}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <DropdownMenu>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== "undefined" &&
                    column.getCanHide()
                )
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <TabsContent
        value="outline"
        className="relative flex flex-col gap-4 overflow-auto"
      >
        <div className="overflow-hidden rounded-lg border">
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            sensors={sensors}
            id={sortableId}
          >
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} colSpan={header.colSpan}>
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
              <TableBody className="**:data-[slot=table-cell]:first:w-8">
                {table.getRowModel().rows?.length ? (
                  <SortableContext
                    items={dataIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {table.getRowModel().rows.map((row) => (
                      <DraggableRow key={row.id} row={row} />
                    ))}
                  </SortableContext>
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="p-0"
                    >
                      <EmptyTableState isFiltered={isFiltered || data.length > 0} />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </div>
        {showPagination && data.length > 0 && (
          <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Baris per halaman</span>
              <Select
                value={String(table.getState().pagination.pageSize)}
                onValueChange={(value) => table.setPageSize(Number(value))}
              >
                <SelectTrigger className="h-8 w-18">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={String(pageSize)}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="text-sm text-muted-foreground">
                Halaman {table.getState().pagination.pageIndex + 1} dari{" "}
                {Math.max(table.getPageCount(), 1)}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  Sebelumnya
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Berikutnya
                </Button>
              </div>
            </div>
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}
