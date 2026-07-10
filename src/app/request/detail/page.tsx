import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import type { DashboardRequest } from "@/types/transaction";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import BastTemplate from "@/features/transactions/components/BastTemplate";

const getBaseUrl = () => {
  const baseUrl = import.meta.env.URL || import.meta.env.VITE_URL || "http://172.168.9.139:3000/";
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
};

const getUnitByCategory = (categoryName?: string) => {
  if (!categoryName) return "Unit";
  const name = categoryName.toLowerCase();
  if (name.includes("kabel") || name.includes("foc") || name.includes("dropwire")) {
    return "Meter";
  }
  return "Unit";
};

const getCleanCategoryName = (categoryName?: string) => {
  if (!categoryName) return "-";
  const name = categoryName.toLowerCase();
  if (name.includes("ont")) return "ONT";
  if (name.includes("dropwire") || name.includes("kabel") || name.includes("foc")) return "DropWire";
  return categoryName;
};

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

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [request, setRequest] = useState<DashboardRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bastData, setBastData] = useState<any>(null);
  const bastRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    const fetchRequest = async () => {
      try {
        const res = await fetch(`${getBaseUrl()}/requests/${id}`, {
          method: "GET",
          headers: getHeaders(),
        });
        if (!res.ok) throw new Error("Gagal mengambil data detail permintaan");
        const data = await res.json();

        const formatted: DashboardRequest = {
          id: data.id,
          requestNumber: data.requestNumber,
          requesterName: data.requester?.profile?.nama || data.requester?.username,
          partnerCategory: data.requester?.profile?.partnerType || "Mitra",
          status: data.status,
          notes: data.notes || "-",
          requestedAt: data.requestedAt,
          itemsCount: data.requestItems?.reduce((acc: number, item: any) => acc + item.quantity, 0),
          requestItems: data.requestItems?.map((item: any) => ({
            id: item.id,
            category: getCleanCategoryName(item.category?.nama),
            brand: item.brand?.nama,
            quantity: item.quantity,
            unit: getUnitByCategory(item.category?.nama)
          })),
          requestAllocations: data.requestItems?.flatMap((item: any) =>
            item.allocations?.map((alloc: any) => ({
              id: alloc.id,
              materialNumber: alloc.item?.paNumber || "-",
              materialCategory: getCleanCategoryName(item.category?.nama),
              brand: alloc.item?.brand?.nama || item.brand?.nama,
              materialName: `${getCleanCategoryName(item.category?.nama)} ${alloc.item?.brand?.nama || item.brand?.nama}`,
              serialNumber: alloc.item?.serialNumber,
              quantity: 1,
              unit: getUnitByCategory(item.category?.nama)
            })) || []
          )
        };
        setRequest(formatted);
      } catch (error) {
        console.error(error);
        toast.error("Gagal memuat detail permintaan");
      } finally {
        setIsLoading(false);
      }
    };

    const fetchBast = async () => {
      try {
        const res = await fetch(`${getBaseUrl()}/requests/${id}/bast`, {
          method: "GET",
          headers: getHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setBastData(data);
        }
      } catch (error) {
        // BAST tidak wajib ada, tidak perlu error toast
        console.log("BAST belum tersedia:", error);
      }
    };
    fetchRequest().then(() => fetchBast());
  }, [id]);

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Memuat detail permintaan...</div>;
  }

  if (!request) {
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-4 min-h-[50vh]">
        <h2 className="text-xl font-semibold">Data Permintaan Tidak Ditemukan</h2>
        <Button onClick={() => navigate(-1)} variant="outline">
          <ArrowLeft className="size-4 mr-2" />
          Kembali
        </Button>
      </div>
    );
  }

  const status = request.status?.toLowerCase() || "";
  const showBast = ["siap", "selesai"].includes(status) && bastData;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full print:p-0 print:m-0 print:block print:max-w-none">
      <div className="flex items-center gap-4 border-b pb-4 print:hidden">
        <Button onClick={() => navigate(-1)} variant="outline" size="icon" className="shrink-0">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight">{request.requestNumber}</h1>
          <p className="text-muted-foreground text-sm">
            Detail Informasi Permintaan
          </p>
        </div>
        <div className="ml-auto flex gap-2 shrink-0">
          <Badge variant="secondary" className="px-3 py-1.5 text-sm font-medium uppercase tracking-wider">
            {request.status}
          </Badge>
        </div>
      </div>

      <div className={`grid gap-6 ${showBast ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'} print:block print:gap-0`}>
        {/* ===== KOLOM KIRI: Detail Transaksi ===== */}
        <div className="flex flex-col gap-6 print:hidden">
          <Card className="shadow-sm">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle>Informasi Umum</CardTitle>
              <CardDescription>Rincian pemohon dan waktu pengajuan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="flex flex-col gap-2">
                  <Label className="text-muted-foreground">Pemohon</Label>
                  <div className="font-semibold text-base">{request.requesterName}</div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-muted-foreground">Kategori</Label>
                  <div className="font-semibold text-base">{request.partnerCategory}</div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-muted-foreground">Tanggal Pengajuan</Label>
                  <div className="font-semibold text-base">
                    {new Date(request.requestedAt).toLocaleDateString("id-ID", {
                      day: "numeric", month: "long", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-muted-foreground">Total Item</Label>
                  <div className="font-semibold text-base">{request.itemsCount}</div>
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-2">
                <Label className="text-muted-foreground">Catatan</Label>
                <div className="text-sm bg-muted/30 p-4 rounded-md min-h-[80px] border border-muted">
                  {request.notes && request.notes !== "-" ? request.notes : <span className="italic text-muted-foreground">Tidak ada catatan yang dilampirkan.</span>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle>
                {request.requestAllocations && request.requestAllocations.length > 0 ? "Alokasi Barang (Material)" : "Daftar Barang (Item)"}
              </CardTitle>
              <CardDescription>Daftar material atau barang untuk permintaan ini</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {['SIAP', 'SELESAI', 'DITERIMA'].includes(request.status?.toUpperCase() || "") ? (
                <div className="rounded-lg border overflow-hidden overflow-x-auto shadow-sm">
                  <Table className="whitespace-nowrap">
                    <TableHeader className="bg-muted/50">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-16 text-center">No</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead>Nama Material</TableHead>
                        <TableHead>Merek</TableHead>
                        <TableHead className="text-right">Jumlah</TableHead>
                        <TableHead className="text-right pr-6">Satuan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {request.requestAllocations && request.requestAllocations.length > 0 ? (
                        request.requestAllocations.map((ra, idx) => (
                          <TableRow key={ra.id}>
                            <TableCell className="text-muted-foreground text-center">{idx + 1}</TableCell>
                            <TableCell className="font-medium">{ra.materialCategory}</TableCell>
                            <TableCell className="truncate max-w-[300px]" title={ra.materialName}>{ra.materialName}</TableCell>
                            <TableCell>{ra.brand}</TableCell>
                            <TableCell className="text-right font-medium">{ra.quantity}</TableCell>
                            <TableCell className="text-right font-medium pr-6">{ra.unit}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                            Belum ada alokasi material spesifik.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              ) : request.status?.toUpperCase() === 'DISETUJUI' ? (
                <div className="rounded-lg border overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-16 text-center">No</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead>Merek</TableHead>
                        <TableHead className="text-right">Jumlah</TableHead>
                        <TableHead className="text-right pr-6">Satuan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {request.requestItems && request.requestItems.length > 0 ? (
                        request.requestItems.map((ri, idx) => (
                          <TableRow key={ri.id}>
                            <TableCell className="text-muted-foreground text-center">{idx + 1}</TableCell>
                            <TableCell className="font-medium">{ri.category}</TableCell>
                            <TableCell>{ri.brand}</TableCell>
                            <TableCell className="text-right font-medium">{ri.quantity}</TableCell>
                            <TableCell className="text-right font-medium pr-6">{ri.unit}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                            Tidak ada item.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              ) : request.requestItems && request.requestItems.length > 0 ? (
                <div className="rounded-lg border overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-16 text-center">No</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead>Merek</TableHead>
                        <TableHead className="text-right pr-6">Jumlah</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {request.requestItems.map((ri, idx) => (
                        <TableRow key={ri.id}>
                          <TableCell className="text-muted-foreground text-center">{idx + 1}</TableCell>
                          <TableCell className="font-medium">{ri.category}</TableCell>
                          <TableCell>{ri.brand}</TableCell>
                          <TableCell className="text-right font-medium pr-6">{ri.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center p-12 text-muted-foreground border rounded-lg bg-muted/10 border-dashed">
                  Tidak ada data barang yang tersedia.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ===== KOLOM KANAN: Pratinjau BAST ===== */}
        {showBast && (
          <div className="flex flex-col gap-4 print:block print:w-full print:m-0 print:p-0 print:bg-white print:static print:rounded-none">
            <Card className="shadow-sm print:shadow-none print:border-none print:bg-transparent print:m-0 print:p-0 print:rounded-none">
              <CardHeader className="bg-muted/30 border-b print:hidden">
                <CardTitle>Pratinjau Dokumen BAST</CardTitle>
                <CardDescription>Bukti Serah Terima Barang resmi</CardDescription>
              </CardHeader>
              <CardContent className="p-0 print:p-0 print:m-0 print:rounded-none">
                <div className="border rounded-md m-4 print:m-0 print:border-none overflow-hidden print:overflow-visible aspect-[1/1.4] print:aspect-auto print:w-full print:block print:rounded-none">
                  <div className="h-full overflow-y-auto print:overflow-visible print:h-auto print:w-full print:block print:m-0 print:p-0 print:rounded-none">
                    <BastTemplate
                      ref={bastRef}
                      documentNumber={bastData.document.documentNumber}
                      requesterName={bastData.request.requesterName}
                      generatedByName={bastData.request.generatedByName}
                      bastDate={bastData.request.processedAt || bastData.request.completedAt || bastData.request.requestedAt}
                      allocations={bastData.request.allocations || []}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Button onClick={handlePrint} className="w-full print:hidden" size="lg">
              <Printer className="size-4 mr-2" />
              Cetak BAST
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
