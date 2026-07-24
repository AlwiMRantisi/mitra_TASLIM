import { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Loader2, PackageCheck, QrCode } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, getBaseUrl } from "@/lib/api";
import type { DashboardRequest } from "@/types/transaction";

interface PengambilanQrModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  request: DashboardRequest | null;
  onSuccess?: () => void;
}

export function PengambilanQrModal({
  isOpen,
  onOpenChange,
  request,
  onSuccess,
}: PengambilanQrModalProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen && request) {
      setIsLoading(true);
      setQrCodeDataUrl("");

      const initSession = async () => {
        try {
          const res = await api.post("/signature-session", { requestId: request.id });
          const sessId = res.data.id;

          const backendBaseUrl = getBaseUrl();
          const mobileUrl = `${backendBaseUrl}/signature-session/${sessId}/mobile`;
          const qrData = await QRCode.toDataURL(mobileUrl, { width: 320, margin: 2 });

          setQrCodeDataUrl(qrData);
          setIsLoading(false);

          // Polling status per 2 detik
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = setInterval(async () => {
            try {
              const pollRes = await api.get(`/signature-session/${sessId}`);
              if (pollRes.data.status === "COMPLETED") {
                if (pollingRef.current) clearInterval(pollingRef.current);
                toast.success("Pengambilan material berhasil! BAST telah diselesaikan.");
                onSuccess?.();
                onOpenChange(false);
              }
            } catch (err) {
              // Ignore polling errors
            }
          }, 2000);
        } catch (err: any) {
          toast.error("Gagal membuat sesi QR Code Pengambilan");
          setIsLoading(false);
        }
      };

      void initSession();
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isOpen, request, onOpenChange, onSuccess]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md flex flex-col items-center text-center p-6">
        <DialogHeader className="w-full text-center space-y-1">
          <DialogTitle className="flex items-center justify-center gap-2 text-lg font-bold">
            <PackageCheck className="size-5 text-sky-500" />
            Pengambilan Material BAST
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {request?.requestNumber ? `Permintaan #${request.requestNumber}` : "Scan QR Code untuk tanda tangan BAST"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="my-8 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="size-10 animate-spin text-sky-500" />
            <p className="text-xs text-muted-foreground font-medium">Membuat Sesi QR Code...</p>
          </div>
        ) : (
          <div className="my-4 flex flex-col items-center space-y-4 w-full">
            <div className="p-3 bg-white rounded-2xl border shadow-sm border-zinc-200">
              <img src={qrCodeDataUrl} alt="QR Code Pengambilan BAST" className="w-56 h-56 rounded-xl" />
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs font-semibold">
              <QrCode className="size-3.5" />
              <span>Scan QR Code dari HP Pengambil</span>
            </div>

            <p className="text-xs text-muted-foreground max-w-xs">
              Minta penerima/pengambil material meng-scan QR Code ini menggunakan HP untuk mengisi <strong>Nama</strong> & <strong>Tanda Tangan Digital</strong>.
            </p>

            <div className="flex items-center justify-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-medium">
              <Loader2 className="size-3.5 animate-spin" />
              <span>Menunggu konfirmasi TTD dari HP...</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
