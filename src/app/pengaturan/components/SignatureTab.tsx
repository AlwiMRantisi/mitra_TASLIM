import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Smartphone, Loader2, Eraser, CheckCircle2, ShieldCheck, Camera, QrCode, PenTool } from "lucide-react";
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
  const signatureUrl = user?.profile?.picSignatureUrl;

  const handleDelete = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      const res = await api.put(`/users/${user.id}`, {
        picSignatureUrl: null,
      });

      if (res.data) {
        updateUser({
          profile: {
            ...user.profile,
            picSignatureUrl: null,
          },
        });
        toast.success("Tanda tangan profil berhasil dihapus");
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

      const url = await QRCode.toDataURL(mobileUrl, { width: 320, margin: 2 });
      setQrCodeUrl(url);
      setQrModalOpen(true);

      if (pollingInterval.current) clearInterval(pollingInterval.current);
      pollingInterval.current = setInterval(async () => {
        try {
          const pollRes = await api.get(`/signature-session/${sessionId}`);
          if (pollRes.data.status === "COMPLETED" && pollRes.data.signatureUrl) {
            if (user) {
              await api.put(`/users/${user.id}`, {
                picSignatureUrl: pollRes.data.signatureUrl,
              });
              updateUser({
                profile: {
                  ...user.profile,
                  picSignatureUrl: pollRes.data.signatureUrl,
                },
              });
            }

            setQrModalOpen(false);
            if (pollingInterval.current) clearInterval(pollingInterval.current);
            toast.success("Tanda tangan profil berhasil diperbarui via HP!");
          }
        } catch (err) {
          // Ignore polling errors
        }
      }, 2000);
    } catch (error) {
      toast.error("Gagal membuat sesi QR Code");
    }
  };

  const handleQrModalClose = (open: boolean) => {
    setQrModalOpen(open);
    if (!open && pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
  };

  return (
    <div className="px-2 pt-14 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tanda Tangan Digital</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola tanda tangan profil default untuk otomatisasi dokumen BAST
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <Card className="overflow-hidden border rounded-xl shadow-xs">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-6 min-h-[320px]">
            {hasSignature && signatureUrl ? (
              <div className="flex flex-col items-center gap-4 text-center w-full max-w-md">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                  <ShieldCheck className="size-3.5" />
                  <span>Tanda Tangan Tersimpan (Format Transparan)</span>
                </div>

                {/* Transparent Checkerboard Pattern Frame */}
                <div className="w-full h-44 rounded-xl border border-zinc-300 dark:border-zinc-800 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(#27272a_1px,transparent_1px)] flex items-center justify-center p-4 shadow-inner relative group">
                  <img
                    src={signatureUrl}
                    alt="Default Signature Preview"
                    className="max-h-36 max-w-full object-contain filter drop-shadow-sm transition-transform duration-200 group-hover:scale-105"
                  />
                  <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-mono text-muted-foreground border">
                    PNG Transparan
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  Tanda tangan ini akan digunakan secara otomatis saat Anda menandatangani dokumen BAST di sistem.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center max-w-md py-4">
                <div className="w-16 h-16 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground mb-1">
                  <PenTool className="size-8 opacity-40" />
                </div>
                <h2 className="text-lg font-semibold">Belum Ada Tanda Tangan Default</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Buat tanda tangan profil Anda sekarang menggunakan HP agar proses pengesahan BAST menjadi cepat dan otomatis.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
              {hasSignature && (
                <Button
                  variant="outline"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="gap-2 text-xs border-rose-500/30 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400">
                  {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Eraser className="size-3.5" />}
                  Hapus Tanda Tangan
                </Button>
              )}
              <Button
                onClick={startQrSession}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-5 shadow-md shadow-emerald-600/20">
                <Smartphone className="size-3.5" />
                {hasSignature ? "Perbarui via HP" : "Buat Tanda Tangan via HP"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* QR Scanning Modal with 3-Step Guidance */}
      <Dialog open={qrModalOpen} onOpenChange={handleQrModalClose}>
        <DialogContent className="sm:max-w-md flex flex-col items-center text-center p-6 gap-4">
          <DialogHeader className="w-full text-center space-y-1">
            <DialogTitle className="text-center font-bold text-lg">Tanda Tangan via Smartphone</DialogTitle>
            <DialogDescription className="text-center text-xs">
              Pindai QR Code di bawah untuk membuka kanvas penandatangan di layar ponsel Anda
            </DialogDescription>
          </DialogHeader>

          {qrCodeUrl ? (
            <div className="relative group p-3 bg-white rounded-2xl border shadow-md border-zinc-200">
              <img src={qrCodeUrl} alt="QR Code Mobile Sign" className="w-52 h-52 rounded-xl" />
            </div>
          ) : (
            <div className="my-6 w-52 h-52 flex items-center justify-center">
              <Loader2 className="size-8 animate-spin text-emerald-500" />
            </div>
          )}

          {/* 3-Step Visual Instruction Bar */}
          <div className="grid grid-cols-3 gap-2 w-full pt-2">
            <div className="flex flex-col items-center text-center bg-muted/50 p-2 rounded-lg border">
              <Camera className="size-4 text-emerald-500 mb-1" />
              <span className="text-[10px] font-semibold">1. Buka Kamera</span>
            </div>
            <div className="flex flex-col items-center text-center bg-muted/50 p-2 rounded-lg border">
              <QrCode className="size-4 text-emerald-500 mb-1" />
              <span className="text-[10px] font-semibold">2. Pindai QR Code</span>
            </div>
            <div className="flex flex-col items-center text-center bg-muted/50 p-2 rounded-lg border">
              <CheckCircle2 className="size-4 text-emerald-500 mb-1" />
              <span className="text-[10px] font-semibold">3. TTD & Kirim</span>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Halaman ini akan otomatis tertutup dan memperbarui profil Anda secara instan setelah menekan <strong>Kirim</strong> di layar HP.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
