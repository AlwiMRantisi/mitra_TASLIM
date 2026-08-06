import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PenTool, Smartphone, Loader2, Eraser, Sparkles, RefreshCw, Clock } from "lucide-react";
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

const SESSION_TIMEOUT_SECONDS = 180;

export function DigitalSignatureDialog({
  open,
  onOpenChange,
  title = "Tanda Tangan Digital BAST",
  description = "Silakan berikan tanda tangan Anda untuk pengesahan dokumen BAST ini.",
  onSignComplete,
}: DigitalSignatureDialogProps) {
  const { user, updateUser } = useAuth();
  const sigPad = useRef<SignatureCanvas>(null);

  const [activeTab, setActiveTab] = useState<"canvas" | "qr">("canvas");
  const [isSigning, setIsSigning] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(SESSION_TIMEOUT_SECONDS);

  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const savedProfileSignature = user?.profile?.picSignatureUrl;
  const hasProfileSignature = !!savedProfileSignature && !isUnsupportedStoredSignature(savedProfileSignature);

  // Load profile signature into canvas if opening or switching
  useEffect(() => {
    if (open && hasProfileSignature && activeTab === "canvas") {
      const timer = setTimeout(() => {
        if (sigPad.current && savedProfileSignature) {
          sigPad.current.fromDataURL(savedProfileSignature);
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [open, hasProfileSignature, savedProfileSignature, activeTab]);

  const handleClear = () => {
    sigPad.current?.clear();
  };

  const handleUseProfileSignature = () => {
    if (!savedProfileSignature || !sigPad.current) return;
    sigPad.current.clear();
    sigPad.current.fromDataURL(savedProfileSignature);
    toast.success("Tanda tangan profil berhasil dimuat ke kanvas!");
  };

  const startQrSession = useCallback(async () => {
    setQrLoading(true);
    setQrCodeUrl("");
    setTimeLeft(SESSION_TIMEOUT_SECONDS);

    try {
      const res = await api.post(`/signature-session`);
      const sessionId = res.data.id;

      const backendBaseUrl = getBaseUrl();
      const mobileUrl = `${backendBaseUrl}/signature-session/${sessionId}/mobile`;
      const url = await QRCode.toDataURL(mobileUrl, { width: 320, margin: 2 });

      setQrCodeUrl(url);
      setQrLoading(false);

      if (pollingInterval.current) clearInterval(pollingInterval.current);
      pollingInterval.current = setInterval(async () => {
        try {
          const pollRes = await api.get(`/signature-session/${sessionId}`);
          if (pollRes.data.status === "COMPLETED" && pollRes.data.signatureUrl) {
            setActiveTab("canvas");
            if (pollingInterval.current) clearInterval(pollingInterval.current);
            if (timerRef.current) clearInterval(timerRef.current);

            setTimeout(() => {
              const newSigUrl = pollRes.data.signatureUrl;
              if (sigPad.current && newSigUrl) {
                sigPad.current.fromDataURL(newSigUrl);
              }

              if (user) {
                updateUser({
                  profile: {
                    ...user.profile,
                    picSignatureUrl: newSigUrl,
                  },
                });
              }
            }, 100);

            toast.success("Tanda tangan berhasil ditangkap dari HP!");
          }
        } catch (err: any) {
          if (err.response?.status === 400 && err.response?.data?.message === "Session expired") {
            void startQrSession();
          }
        }
      }, 2000);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            void startQrSession();
            return SESSION_TIMEOUT_SECONDS;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      toast.error("Gagal membuat sesi QR Code");
      setQrLoading(false);
    }
  }, [user, updateUser]);

  useEffect(() => {
    if (activeTab === "qr") {
      void startQrSession();
    } else {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [activeTab, startQrSession]);

  useEffect(() => {
    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleSubmit = async () => {
    if (sigPad.current?.isEmpty()) {
      toast.error("Tanda tangan tidak boleh kosong");
      return;
    }

    setIsSigning(true);
    try {
      const signatureDataUrl = getSignatureDataUrl(sigPad.current!);

      if (user) {
        await api.put(`/users/${user.id}`, {
          picSignatureUrl: signatureDataUrl,
        });
        updateUser({
          profile: {
            ...user.profile,
            picSignatureUrl: signatureDataUrl,
          },
        });
      }

      onSignComplete();
    } catch (error) {
      toast.error("Gagal memproses tanda tangan");
    } finally {
      setIsSigning(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) {
          if (pollingInterval.current) clearInterval(pollingInterval.current);
          if (timerRef.current) clearInterval(timerRef.current);
        }
        onOpenChange(val);
      }}>
      <DialogContent className="sm:max-w-md gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <PenTool className="size-4 text-emerald-500" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs">{description}</DialogDescription>
        </DialogHeader>

        {/* Mode Selector Segmented Tabs */}
        <div className="grid grid-cols-2 gap-1 bg-muted p-1 rounded-lg text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("canvas")}
            className={`py-1.5 px-3 rounded-md transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "canvas" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}>
            <PenTool className="size-3.5" />
            <span>TTD di Layar</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("qr")}
            className={`py-1.5 px-3 rounded-md transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "qr" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}>
            <Smartphone className="size-3.5" />
            <span>Scan via HP</span>
          </button>
        </div>

        {activeTab === "qr" ? (
          <div className="flex flex-col items-center justify-center py-2 space-y-3">
            {qrLoading ? (
              <div className="w-48 h-48 flex flex-col items-center justify-center gap-2">
                <Loader2 className="size-8 animate-spin text-emerald-500" />
                <span className="text-xs text-muted-foreground">Menyiapkan QR Code...</span>
              </div>
            ) : (
              <>
                <div className="p-3 bg-white rounded-2xl shadow-sm border">
                  <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 rounded-xl" />
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span>Sesi Aktif</span>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono bg-muted px-2.5 py-1 rounded-full border">
                    <Clock className="size-3 text-amber-500" />
                    <span>{formatTime(timeLeft)}</span>
                  </div>
                </div>

                <p className="text-xs text-center text-muted-foreground leading-relaxed px-4">
                  Pindai QR Code ini dengan kamera HP Anda untuk membuat tanda tangan layar penuh.
                </p>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void startQrSession()}
                  className="text-xs gap-1.5 text-muted-foreground hover:text-foreground h-8">
                  <RefreshCw className="size-3" /> Refresh QR Manual
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-1">
            {/* 1-Click Profile Signature Fill Button */}
            {hasProfileSignature && (
              <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-xs">
                <span className="text-emerald-700 dark:text-emerald-300 font-medium">TTD Default Profil Tersedia</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleUseProfileSignature}
                  className="h-7 text-[11px] gap-1 bg-emerald-600 text-white hover:bg-emerald-700 font-medium">
                  <Sparkles className="size-3" />
                  Gunakan TTD Profil
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Kanvas Tanda Tangan</span>
              <Button variant="ghost" size="sm" onClick={handleClear} className="h-7 gap-1 px-2 text-xs">
                <Eraser className="size-3.5" /> Bersihkan
              </Button>
            </div>

            {/* Desktop Canvas Container with Baseline Guide */}
            <div className="rounded-xl border bg-white dark:bg-zinc-950 overflow-hidden h-[190px] relative shadow-inner">
              <SignatureCanvas
                ref={sigPad}
                penColor="black"
                canvasProps={{
                  width: 600,
                  height: 190,
                  style: { width: "100%", height: "100%" },
                  className: "cursor-crosshair",
                }}
              />
              <div className="absolute inset-x-6 bottom-8 pointer-events-none border-b border-dashed border-zinc-300 dark:border-zinc-700 pb-1 flex items-center justify-center">
                <span className="text-zinc-300 dark:text-zinc-700 select-none uppercase tracking-widest text-[11px] font-semibold opacity-60">
                  Garis Panduan Tanda Tangan
                </span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-normal">
              Tanda tangan ini akan disimpan di profil Anda dan dilampirkan langsung pada dokumen BAST.
            </p>
          </div>
        )}

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSigning} className="text-xs">
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSigning || activeTab === "qr"}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">
            {isSigning ? <Loader2 className="size-3.5 animate-spin" /> : <PenTool className="size-3.5" />}
            Konfirmasi Tanda Tangan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
