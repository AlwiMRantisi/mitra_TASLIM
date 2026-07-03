import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth"
import { toast } from "sonner"
import { invoke } from "@tauri-apps/api/core"
import {
  RefreshCw,
  LogOut,
  Cloud,
  Lock,
  Unlock
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

const GOOGLE_CLIENT_ID = import.meta.env.GOOGLE_CLIENT_ID || "847352193552-odl1tr4a71os3eddiftnu9en4ncg7mqg.apps.googleusercontent.com";

/**
 * Helper: Mengembalikan Base URL untuk pemanggilan API.
 * 
 * @returns {string} String URL API Backend.
 */
const getBaseUrl = () => {
  const baseUrl = import.meta.env.URL || import.meta.env.VITE_URL || "http://172.168.9.139:3000/";
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
};

/**
 * Komponen PengaturanPage
 * 
 * Halaman pengaturan global aplikasi. Menangani integrasi pihak ketiga seperti
 * koneksi Google OAuth2 dan konfigurasi ID folder Google Drive.
 * Fitur-fitur ini umumnya dibatasi hanya untuk role Admin.
 * 
 * @returns {JSX.Element} Antarmuka halaman pengaturan.
 */
export default function PengaturanPage() {
  const { user } = useAuth()
  const isAdmin = user?.role?.toLowerCase() === "admin";

  const [isGoogleConnected, setIsGoogleConnected] = useState(false)
  const [googleEmail, setGoogleEmail] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  // Drive Folder ID state
  const [driveFolderId, setDriveFolderId] = useState("")
  const [isSavingFolderId, setIsSavingFolderId] = useState(false)
  const [isLoadingFolderId, setIsLoadingFolderId] = useState(true)
  const [isInputActive, setIsInputActive] = useState(false)

  useEffect(() => {
    /**
     * Memeriksa status koneksi Google dari backend.
     */
    const fetchGoogleStatus = async () => {
      try {
        const token = localStorage.getItem("arxiva-auth-token");
        if (!token) return;

        const res = await fetch(`${getBaseUrl()}/auth/google/status`, {
          headers: { Authorization: token }
        });

        if (res.ok) {
          const data = await res.json();
          setIsGoogleConnected(data.googleConnected);
          if (data.googleEmail) {
            setGoogleEmail(data.googleEmail);
          }
        }
      } catch (error) {
        console.error("Gagal mengambil status Google:", error);
      }
    };

    /**
     * Mengambil konfigurasi ID Folder root Google Drive yang tersimpan di sistem.
     */
    const fetchDriveFolderId = async () => {
      try {
        const token = localStorage.getItem("arxiva-auth-token");
        if (!token) return;

        const res = await fetch(`${getBaseUrl()}/auth/google/folder-id`, {
          headers: { Authorization: token }
        });

        if (res.ok) {
          const data = await res.json();
          if (data.rootFolderId) {
            setDriveFolderId(data.rootFolderId);
          }
        }
      } catch (error) {
        console.error("Gagal mengambil ID Folder Drive:", error);
      } finally {
        setIsLoadingFolderId(false);
      }
    };

    fetchGoogleStatus();
    fetchDriveFolderId();
  }, [user]);

  /**
   * Menyimpan konfigurasi ID Folder Drive ke backend.
   * Hanya Admin yang diizinkan untuk mengubah pengaturan sistem ini.
   */
  const handleSaveDriveFolderId = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error("Hanya Admin yang diizinkan untuk mengubah ID Folder Drive.");
      return;
    }
    setIsSavingFolderId(true);
    try {
      const token = localStorage.getItem("arxiva-auth-token");
      const res = await fetch(`${getBaseUrl()}/auth/google/folder-id`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token || "",
        },
        body: JSON.stringify({ rootFolderId: driveFolderId }),
      });

      if (!res.ok) {
        throw new Error("Gagal menyimpan ID Folder Drive");
      }

      toast.success("ID Folder Drive berhasil disimpan!");
      setIsInputActive(false);
    } catch (error: any) {
      console.error("Error saving Drive Folder ID:", error);
      toast.error(error.message || "Gagal menyimpan ID Folder Drive");
    } finally {
      setIsSavingFolderId(false);
    }
  };

  /**
   * Memulai alur otentikasi Google OAuth2.
   * Menggabungkan panggilan sistem operasi Tauri (membuka browser) dengan API Express (tukar kode).
   */
  const handleConnectGoogle = async () => {
    if (!isAdmin) {
      toast.error("Hanya Admin yang diizinkan untuk menghubungkan akun Google.");
      return;
    }
    setIsConnecting(true);
    toast.info("Membuka browser untuk otentikasi Google...");

    try {
      // Langkah 1: Memanggil fungsi Rust (Tauri API) untuk membuka browser default 
      // dan menangkap kode otorisasi OAuth dari callback URL lokal.
      const code = await invoke<string>("google_oauth_login", {
        clientId: GOOGLE_CLIENT_ID,
      });

      toast.info("Menukar kode otorisasi...");

      // Langkah 2: Mengirim kode otorisasi tersebut ke backend Node.js.
      // Backend akan menukarnya dengan Access Token & Refresh Token via Google API.
      const token = localStorage.getItem("arxiva-auth-token");
      const res = await fetch(`${getBaseUrl()}/auth/google/exchange`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token || "",
        },
        body: JSON.stringify({
          code,
          userId: user?.id,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Gagal menukar kode otorisasi");
      }

      const data = await res.json();
      setIsGoogleConnected(data.googleConnected);
      setGoogleEmail(data.googleEmail);
      toast.success(`Berhasil menghubungkan akun Google (${data.googleEmail})!`);
    } catch (error: any) {
      console.error("OAuth2 Error:", error);
      const message = typeof error === "string" ? error : error?.message || "Terjadi kesalahan";
      toast.error(`Gagal menghubungkan Google: ${message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!isAdmin) {
      toast.error("Hanya Admin yang diizinkan untuk memutuskan koneksi akun Google.");
      return;
    }
    setIsDisconnecting(true);
    try {
      const token = localStorage.getItem("arxiva-auth-token");
      if (token) {
        await fetch(`${getBaseUrl()}/auth/google/disconnect`, {
          method: "DELETE",
          headers: { Authorization: token }
        });
      }

      setIsGoogleConnected(false);
      setGoogleEmail("");
      toast.success("Koneksi akun Google berhasil diputuskan.");
    } catch (error) {
      toast.error("Gagal memutuskan koneksi akun Google.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="@container/main flex h-full select-none flex-col gap-6 py-6 w-full mx-auto">
      {/* Page Header */}
      <div className="flex flex-col gap-1.5 px-4 lg:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pengaturan</h1>
        <p className="text-sm text-muted-foreground">
          Pusat kendali untuk mengelola akun, integrasi, dan personalisasi sistem.
        </p>
      </div>

      {/* Tabs Container */}
      <Tabs defaultValue="google-drive" className="px-4 lg:px-6 w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="google-drive" className="px-4 py-1.5 text-sm font-medium">Google Drive</TabsTrigger>
        </TabsList>

        {/* Tab Content: Google Drive */}
        <TabsContent value="google-drive" className="flex flex-col gap-6 mt-0">
          {/* Drive Folder ID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b pb-9 pt-2">
            <div className="flex items-center">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-medium">Drive Folder ID</h2>
                  {!isAdmin && <Badge variant="secondary" className="text-xs font-normal">Akses Admin</Badge>}
                </div>
                <p className="text-muted-foreground text-sm max-w-xl mt-1">Simpan Folder ID Drive untuk menentukan folder root.</p>
              </div>
            </div>
            <div className="flex w-full">
              <form onSubmit={handleSaveDriveFolderId} className="flex w-full flex-col gap-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Label htmlFor="driveFolderId" className="font-medium">ID Folder Google Drive</Label>
                  </div>
                  <div className="relative">
                    <Input
                      id="driveFolderId"
                      value={driveFolderId}
                      onChange={(e) => setDriveFolderId(e.target.value)}
                      disabled={!isAdmin || isLoadingFolderId || isSavingFolderId || !isInputActive}
                      className="p-5 pr-12"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setIsInputActive(!isInputActive)}
                      disabled={!isAdmin || isLoadingFolderId || isSavingFolderId}
                      className="absolute right-2 top-1 text-muted-foreground hover:text-foreground"
                    >
                      {isInputActive ? (
                        <Unlock className="size-4" />
                      ) : (
                        <Lock className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Google OAuth2 */}
          <Card className="flex flex-col mb-6 h-fit shadow-sm hover:shadow-md transition-all duration-300">
            <CardHeader className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
                  <Cloud className="size-5 text-primary" />
                  Google OAuth2
                  {!isAdmin && <Badge variant="secondary" className="text-xs font-normal">Akses Admin</Badge>}
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  {isGoogleConnected
                    ? "Akun Google terhubung untuk seluruh sistem aplikasi (upload file, pembuatan folder, dan sinkronisasi spreadsheet)."
                    : "Menghubungkan akun Google untuk otentikasi dan akses layanan terintegrasi."}
                </CardDescription>
              </div>
              <Badge variant="outline" className="w-fit font-medium shadow-sm">
                {isGoogleConnected ? "OAuth2 Terhubung" : "Belum Terhubung"}
              </Badge>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col pt-6">
              {/* Google Connection Box */}
              {isGoogleConnected ? (
                <div className="flex flex-col gap-4 rounded-xl border bg-gradient-to-br from-muted/20 via-background to-muted/30 p-6 shadow-sm backdrop-blur-sm">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-foreground tracking-tight">{googleEmail}</span>
                      <Badge variant="secondary" className="font-normal px-2.5 py-0.5 shadow-sm">OAuth2 Aktif</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Akun Google ini saat ini telah terhubung secara aman dengan sistem untuk digunakan oleh seluruh pengguna aplikasi.
                      {!isAdmin && " (Hanya Admin yang dapat mengubah atau memutuskan tautan akun)."}
                    </p>
                  </div>
                  <div className="flex justify-start pt-2 border-t border-muted">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDisconnectGoogle}
                      disabled={!isAdmin || isDisconnecting}
                      className="gap-2 font-medium shadow-sm transition-all active:scale-98"
                    >
                      {isDisconnecting ? (
                        <>
                          <RefreshCw className="size-4 animate-spin" />
                          Memutuskan...
                        </>
                      ) : (
                        <>
                          <LogOut className="size-4" />
                          Putuskan Tautan Akun
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-5 rounded-xl border border-dashed bg-muted/15 px-6 py-8 text-center transition-all duration-300 hover:bg-muted/25">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
                    <Cloud className="size-7" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-base font-semibold text-foreground tracking-tight">
                      Hubungkan Akun Google Anda
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground max-w-md mx-auto">
                      {isAdmin
                        ? "Sistem memerlukan izin OAuth2 untuk mengotentikasi dan menghubungkan akun Google Anda dengan layanan aplikasi."
                        : "Sistem memerlukan izin OAuth2 dari Admin untuk mengotentikasi dan menghubungkan akun Google dengan layanan aplikasi."}
                    </p>
                  </div>
                  <Button
                    onClick={handleConnectGoogle}
                    disabled={!isAdmin || isConnecting}
                    size="default"
                    className="gap-2 font-medium shadow-sm transition-all active:scale-98"
                  >
                    {isConnecting ? (
                      <>
                        <RefreshCw className="size-4 animate-spin" />
                        Menghubungkan...
                      </>
                    ) : (
                      <>
                        <svg className="size-4" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                        Hubungkan dengan Google (OAuth2)
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
