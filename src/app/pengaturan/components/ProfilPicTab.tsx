import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import SignatureCanvas from "react-signature-canvas";
import { PenTool, Smartphone, Loader2, Save, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import QRCode from "qrcode";
import { getSignatureDataUrl } from "@/lib/trimCanvas";

export function ProfilPicTab() {
  const { user, updateUser } = useAuth();
  const [picName, setPicName] = useState("");
  const sigPad = useRef<SignatureCanvas>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (user) {
      setPicName(user.profile?.picName || user.displayName || "");
      // Need a small timeout to let the canvas render before loading data URL
      setTimeout(() => {
        const sigUrl = user.profile?.picSignatureUrl;
        if (sigUrl && sigPad.current) {
          sigPad.current.fromDataURL(sigUrl);
        }
      }, 100);
    }
  }, [user]);

  const handleClear = () => {
    sigPad.current?.clear();
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const signatureDataUrl = sigPad.current?.isEmpty() ? null : getSignatureDataUrl(sigPad.current!);
      
      const res = await api.put(`/users/${user.id}`, { 
        picName, 
        picSignatureUrl: signatureDataUrl 
      });
      
      if (res.data) {
        // Refresh local auth context
        updateUser({
          profile: {
            ...user.profile,
            picName,
            picSignatureUrl: signatureDataUrl
          }
        });
        toast.success("Profil dan Tanda Tangan berhasil disimpan");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Gagal menyimpan profil");
    } finally {
      setIsSaving(false);
    }
  };

  const startQrSession = async () => {
    try {
      const res = await api.post(`/signature-session`);
      const sessionId = res.data.id;
      
      // Determine the public URL. Assuming HashRouter is used based on App.tsx
      const baseFrontendUrl = import.meta.env.VITE_FRONTEND_URL || window.location.origin;
      const mobileUrl = `${baseFrontendUrl}${window.location.pathname}#/mobile-sign/${sessionId}`;
      
      const url = await QRCode.toDataURL(mobileUrl, { width: 300, margin: 2 });
      setQrCodeUrl(url);
      setQrModalOpen(true);
      
      // Poll every 2 seconds
      pollingInterval.current = setInterval(async () => {
        try {
          const pollRes = await api.get(`/signature-session/${sessionId}`);
          if (pollRes.data.status === "COMPLETED" && pollRes.data.signatureUrl) {
            if (sigPad.current) {
              sigPad.current.fromDataURL(pollRes.data.signatureUrl);
            }
            setQrModalOpen(false);
            if (pollingInterval.current) clearInterval(pollingInterval.current);
            toast.success("Tanda tangan berhasil ditangkap dari HP!");
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
    <Card className="flex flex-col shadow-sm">
      <CardHeader className="border-b pb-4">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <PenTool className="size-5 text-primary" />
          Profil PIC & Tanda Tangan
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Kelola nama penanggung jawab (Person In Charge) dan tanda tangan digital untuk keperluan BAST.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-6 space-y-6">
        <div className="space-y-3">
          <Label htmlFor="picName" className="font-medium">Nama PIC (Person In Charge)</Label>
          <Input 
            id="picName" 
            placeholder="Masukkan nama lengkap" 
            value={picName} 
            onChange={(e) => setPicName(e.target.value)} 
          />
          <p className="text-xs text-muted-foreground">
            Nama ini akan dicetak di bagian bawah tanda tangan dokumen BAST.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="font-medium">Tanda Tangan Digital</Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClear} className="h-8 gap-1.5 text-xs">
                <Eraser className="size-3.5" /> Bersihkan
              </Button>
              <Button variant="secondary" size="sm" onClick={startQrSession} className="h-8 gap-1.5 text-xs bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400">
                <Smartphone className="size-3.5" /> Tanda Tangan via HP
              </Button>
            </div>
          </div>
          
          <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white overflow-hidden h-[250px] relative">
            <SignatureCanvas 
              ref={sigPad}
              penColor="black"
              canvasProps={{
                width: 600,
                height: 250,
                style: { width: "100%", height: "100%" },
                className: "cursor-crosshair"
              }}
            />
            <div className="absolute inset-0 pointer-events-none border border-dashed border-zinc-300 dark:border-zinc-700 m-4 rounded-sm opacity-50 flex items-center justify-center">
              <span className="text-zinc-300 dark:text-zinc-700 select-none uppercase tracking-widest text-sm font-semibold opacity-50">
                Area Tanda Tangan
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSaveProfile} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Simpan Profil & TTD
          </Button>
        </div>
      </CardContent>

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
            Halaman ini akan otomatis tertutup dan memuat tanda tangan setelah Anda menekan <strong>Kirim</strong> di layar HP.
          </p>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
