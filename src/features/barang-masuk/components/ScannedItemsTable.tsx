import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { EmptyScanTableState } from "./EmptyScanTableState";
import { ScannedTableRow } from "./ScannedTableRow";
import type { BarangMasukItem } from "@/types/transaction";
import type { BrandDefinition, LocationDefinition, LokasiOption } from "@/types/inventory";

interface ScannedItemsTableProps {
  barangMasuk: BarangMasukItem[];
  dbBrands: BrandDefinition[];
  dbCategories: string[];
  dbModels: any[];
  dbLocations: LocationDefinition[];
  kuota: Record<string, number>;
  asalBarang: string;
  isSaving: boolean;
  handleUpdateInline: (id: number, field: keyof BarangMasukItem, val: any) => void;
  handleUpdateLokasi: (id: number, val: LokasiOption) => void;
  handleDeleteItem: (id: number) => void;
  handleValidateAll: () => void;
  focusKodeBarangInput: () => void;
}

export function ScannedItemsTable({
  barangMasuk,
  dbBrands,
  dbCategories,
  dbModels,
  dbLocations,
  kuota,
  asalBarang,
  isSaving,
  handleUpdateInline,
  handleUpdateLokasi,
  handleDeleteItem,
  handleValidateAll,
  focusKodeBarangInput
}: ScannedItemsTableProps) {
  return (
    <Card className="@container/card flex flex-1 flex-col @5xl/main:min-h-[calc(100svh-var(--header-height)-15rem)]">
      <CardHeader className="flex flex-col gap-3 border-b pb-4 @lg/card:flex-row @lg/card:items-center @lg/card:justify-between">
        <div className="space-y-1">
          <CardTitle>Daftar Barang Masuk</CardTitle>
        </div>
        <Badge variant="outline" className="w-fit">
          {barangMasuk.length} Item
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="relative flex-1 overflow-auto rounded-lg border max-h-[calc(100svh-5rem)] [&_div[data-slot=table-container]]:overflow-visible [&_table]:mb-0">
          <Table>
            <TableHeader className="sticky top-0 z-20 bg-accent border-b">
              <TableRow>
                <TableHead className="w-14">No</TableHead>
                <TableHead>Serial Number</TableHead>
                <TableHead>Merek</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Asal</TableHead>
                <TableHead>Lokasi</TableHead>
                <TableHead className="w-16 text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {barangMasuk.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="p-0">
                    <EmptyScanTableState />
                  </TableCell>
                </TableRow>
              ) : (
                barangMasuk.map((item, index) => (
                  <ScannedTableRow
                    key={item.id}
                    item={item}
                    index={index}
                    dbBrands={dbBrands}
                    dbCategories={dbCategories}
                    dbModels={dbModels}
                    dbLocations={dbLocations}
                    kuota={kuota}
                    asalBarang={asalBarang}
                    handleUpdateInline={handleUpdateInline}
                    handleUpdateLokasi={handleUpdateLokasi}
                    handleDeleteItem={handleDeleteItem}
                    focusKodeBarangInput={focusKodeBarangInput}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <CardFooter className="justify-end gap-2">
        <Button
          className="w-full gap-2 sm:w-auto"
          size="lg"
          onClick={handleValidateAll}
          disabled={barangMasuk.length === 0 || isSaving}
        >
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
          Simpan Semua
        </Button>
      </CardFooter>
    </Card>
  );
}
