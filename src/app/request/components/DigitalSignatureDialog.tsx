import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PenTool, Smartphone, Loader2, Eraser } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";
import { toast } from "sonner";
import { api, getBaseUrl } from "@/lib/api";
import QRCode from "qrcode";
import { useAuth } from "@/lib/auth";
import { getSignatureDataUrl } from "@/lib/trimCanvas";

interface DigitalSignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  onSignComplete: () => void;
}

const isUnsupportedStoredSignature = (value?: string | null) =>
  typeof value === "string" && value.startsWith("data:image/svg+xml");

export function DigitalSignatureDialog({
  open,
  onOpenChange,
  title = "Tanda Tangan Digital BAST",
  description = "Silakan berikan tanda tangan Anda untuk dokumen BAST ini.",
  onSignComplete
}: DigitalSignatureDialogProps) {
  const { user, updateUser } = useAuth();
  const sigPad = useRef<SignatureCanvas>(null);
  
  const [isSigning, setIsSigning] = useState(false);
  const [qrMode, setQrMode] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  // Load user's saved signature if available
  useEffect(() => {
    if (open && user?.profile?.picSignatureUrl && !qrMode) {
      setTimeout(() => {
        const sigUrl = user?.profile?.picSignatureUrl;
        if (isUnsupportedStoredSignature(sigUrl)) {
          sigPad.current?.clear();
          updateUser({
            profile: {
              ...user.profile,
              picSignatureUrl: null,
            },
          });
          return;
        }

        if (sigPad.current && sigUrl) {
          sigPad.current.fromDataURL(sigUrl);
        }
      }, 150);
    }
  }, [open, user, qrMode, updateUser]);

  // Clean up polling on unmount or close
  useEffect(() => {
    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
    };
  }, []);

  const handleClear = () => {
    sigPad.current?.clear();
  };

  const startQrSession = async () => {
    try {
      const res = await api.post(`/signature-session`);
      const sessionId = res.data.id;
      
      const backendBaseUrl = getBaseUrl();
      const mobileUrl = `${backendBaseUrl}/signature-session/${sessionId}/mobile`;
      const url = await QRCode.toDataURL(mobileUrl, { width: 300, margin: 2 });

      
      setQrCodeUrl(url);
      setQrMode(true);
      
      pollingInterval.current = setInterval(async () => {
        try {
          const pollRes = await api.get(`/signature-session/${sessionId}`);
          if (pollRes.data.status === "COMPLETED" && pollRes.data.signatureUrl) {
            // End polling and go back to canvas with new signature
            setQrMode(false);
            if (pollingInterval.current) clearInterval(pollingInterval.current);
            
            // Wait for QR modal to disappear and Canvas to mount
            setTimeout(() => {
              const newSigUrl = pollRes.data.signatureUrl;
              if (sigPad.current && newSigUrl) {
                sigPad.current.fromDataURL(newSigUrl);
              }
              
              if (user) {
                updateUser({
                  profile: {
                    ...user.profile,
                    picSignatureUrl: newSigUrl
                  }
                });
              }
            }, 100);
            
            toast.success("Tanda tangan berhasil ditangkap dari HP!");
          }
        } catch (err) {
          // ignore
        }
      }, 2000);
      
    } catch (error) {
      toast.error("Gagal membuat sesi QR");
    }
  };

  const handleCancelQr = () => {
    setQrMode(false);
    if (pollingInterval.current) clearInterval(pollingInterval.current);
  };

  const handleSubmit = async () => {
    if (sigPad.current?.isEmpty()) {
      toast.error("Tanda tangan tidak boleh kosong");
      return;
    }
    
    setIsSigning(true);
    try {
      // If the signature is modified, we save it to the user's profile first
      // Actually, we can just call the save profile API then call onSignComplete
      // Or we assume the profile is already saved, but let's just save it.
      const signatureDataUrl = getSignatureDataUrl(sigPad.current!);
      
      if (user) {
        await api.put(`/users/${user.id}`, { 
          picSignatureUrl: signatureDataUrl 
        });
        updateUser({
          profile: {
            ...user.profile,
            picSignatureUrl: signatureDataUrl
          }
        });
      }
      
      onSignComplete();
      
    } catch (error) {
      toast.error("Gagal memproses tanda tangan");
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val && pollingInterval.current) clearInterval(pollingInterval.current);
      onOpenChange(val);
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="size-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {qrMode ? (
          <div className="flex flex-col items-center justify-center py-4 space-y-4">
            <p className="text-sm text-center text-muted-foreground">
              Scan QR Code ini dengan kamera HP Anda untuk menandatangani.
            </p>
            {qrCodeUrl ? (
              <div className="p-3 bg-white rounded-lg shadow-sm border">
                <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
              </div>
            ) : (
              <div className="w-48 h-48 flex items-center justify-center">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <Button variant="outline" onClick={handleCancelQr} className="w-full mt-2">
              Batal & Kembali ke Layar
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Area Tanda Tangan</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleClear} className="h-8 gap-1 px-2 text-xs">
                  <Eraser className="size-3.5" /> Hapus
                </Button>
                <Button variant="outline" size="sm" onClick={startQrSession} className="h-8 gap-1 px-2 text-xs">
                  <Smartphone className="size-3.5" /> via HP
                </Button>
              </div>
            </div>
            
            <div className="rounded-md border bg-white dark:bg-zinc-950 overflow-hidden h-[200px] relative">
              <SignatureCanvas 
                ref={sigPad}
                penColor="black"
                canvasProps={{
                  width: 600,
                  height: 200,
                  style: { width: "100%", height: "100%" },
                  className: "cursor-crosshair"
                }}
              />
              <div className="absolute inset-0 pointer-events-none border border-dashed border-zinc-300 dark:border-zinc-700 m-2 rounded-sm opacity-50 flex items-center justify-center">
                <span className="text-zinc-300 dark:text-zinc-700 select-none uppercase tracking-widest text-sm font-semibold opacity-50">
                  Tanda Tangan Disini
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Tanda tangan ini akan disimpan di profil Anda dan dilampirkan ke dokumen BAST.
            </p>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSigning || qrMode}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={isSigning || qrMode} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            {isSigning ? <Loader2 className="size-4 animate-spin" /> : <PenTool className="size-4" />}
            Konfirmasi Tanda Tangan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
