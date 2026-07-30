import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Smartphone, Loader2, Eraser, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { api, getBaseUrl } from "@/lib/api";
import QRCode from "qrcode";

export function SignatureTab() {
  const { user, updateUser } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  const hasSignature = !!user?.profile?.picSignatureUrl;

  const handleDelete = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      const res = await api.put(`/users/${user.id}`, {
        picSignatureUrl: null
      });

      if (res.data) {
        updateUser({
          profile: {
            ...user.profile,
            picSignatureUrl: null
          }
        });
        toast.success("Tanda tangan berhasil dihapus");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Gagal menghapus tanda tangan");
    } finally {
      setIsDeleting(false);
    }
  };

  const startQrSession = async () => {
    try {
      const res = await api.post(`/signature-session`, { userId: user?.id });
      const sessionId = res.data.id;

      const backendBaseUrl = getBaseUrl();
      const mobileUrl = `${backendBaseUrl}/signature-session/${sessionId}/mobile`;

      const url = await QRCode.toDataURL(mobileUrl, { width: 300, margin: 2 });
      setQrCodeUrl(url);
      setQrModalOpen(true);

      pollingInterval.current = setInterval(async () => {
        try {
          const pollRes = await api.get(`/signature-session/${sessionId}`);
          if (pollRes.data.status === "COMPLETED" && pollRes.data.signatureUrl) {
            // Update profile with the new signature
            if (user) {
              await api.put(`/users/${user.id}`, {
                picSignatureUrl: pollRes.data.signatureUrl
              });
              updateUser({
                profile: {
                  ...user.profile,
                  picSignatureUrl: pollRes.data.signatureUrl
                }
              });
            }

            setQrModalOpen(false);
            if (pollingInterval.current) clearInterval(pollingInterval.current);
            toast.success("Tanda tangan berhasil diperbarui via HP!");
          }
        } catch (err) {
          // Ignore network errors during polling
        }
      }, 2000);

    } catch (error) {
      toast.error("Gagal membuat sesi QR");
    }
  };

  const handleQrModalClose = (open: boolean) => {
    setQrModalOpen(open);
    if (!open && pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
  };

  return (
    <div className="px-2 pt-14">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium">Tanda Tangan Digital</h1>
          <span className="text-sm text-muted-foreground">Kelola tanda tangan default untuk dokumen BAST</span>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <Card className="rounded-sm p-0!">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-6 min-h-[300px]">
            {hasSignature ? (
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-2">
                  <CheckCircle2 className="size-8" />
                </div>
                <h2 className="text-lg font-semibold">Tanda Tangan Tersimpan</h2>
                <p className="text-sm text-muted-foreground max-w-[300px]">
                  Anda telah menyimpan tanda tangan default. Tanda tangan ini akan otomatis digunakan saat memproses BAST.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 mb-2">
                  <XCircle className="size-8" />
                </div>
                <h2 className="text-lg font-semibold">Belum Ada Tanda Tangan</h2>
                <p className="text-sm text-muted-foreground max-w-[300px]">
                  Anda belum mengatur tanda tangan default. Atur sekarang untuk mempermudah proses penandatanganan dokumen BAST.
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
              {hasSignature && (
                <Button variant="outline" onClick={handleDelete} disabled={isDeleting} className="gap-2">
                  {isDeleting ? <Loader2 className="size-4 animate-spin" /> : <Eraser className="size-4" />}
                  Hapus Tanda Tangan
                </Button>
              )}
              <Button onClick={startQrSession} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Smartphone className="size-4" />
                {hasSignature ? "Perbarui" : "Buat Tanda Tangan"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={qrModalOpen} onOpenChange={handleQrModalClose}>
        <DialogContent className="sm:max-w-md flex flex-col items-center text-center">
          <DialogHeader className="w-full">
            <DialogTitle className="text-center">Tanda Tangan via Perangkat Mobile</DialogTitle>
            <DialogDescription className="text-center">
              Scan QR Code ini menggunakan kamera HP Anda untuk membuka kanvas tanda tangan layar penuh.
            </DialogDescription>
          </DialogHeader>

          {qrCodeUrl ? (
            <div className="my-6 p-4 bg-white rounded-xl shadow-sm border">
              <img src={qrCodeUrl} alt="QR Code Mobile Sign" className="w-48 h-48" />
            </div>
          ) : (
            <div className="my-6 w-48 h-48 flex items-center justify-center">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          )}

          <p className="text-sm text-muted-foreground mt-2 max-w-[280px]">
            Halaman ini akan otomatis tertutup setelah Anda menekan <strong>Kirim</strong> di layar HP.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
