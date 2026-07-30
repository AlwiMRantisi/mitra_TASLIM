import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth"
import { toast } from "sonner"
// import removed
import {
  RefreshCw,
  LogOut,
  Cloud,
  Lock,
  Unlock,
  User,
  Settings,
  Save,
  CheckCircle2,
  AlertCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
// import removed
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
// import removed
import { ProfileTab } from "./components/ProfileTab"
import { SecurityTab } from "./components/SecurityTab"
import { SignatureTab } from "./components/SignatureTab"
import { SidebarNav } from "./components/SidebarNav"

// constant removed

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

  // Active Category State for Sidebar Navigation
  const [activeCategory, setActiveCategory] = useState("profil")

  const sidebarGroups = [
    {
      groupLabel: "Pengaturan Akun",
      items: [
        {
          title: "Profil",
          id: "profil"
        },
        {
          title: "Keamanan",
          id: "keamanan"
        },
        {
          title: "Tanda Tangan Digital",
          id: "ttd-digital"
        }
      ]
    },
    {
      groupLabel: "Administration",
      items: [
        {
          title: "Integrasi & Cloud",
          icon: <Settings className="size-4" />,
          id: "google-drive",
          adminOnly: true
        }
      ]
    }
  ]

  useEffect(() => {
    /**
     * Memeriksa status koneksi Google dari backend.
     * Menggunakan session token yang sama dari frontend.
     */
    const checkGoogleConnection = async () => {
      try {
        const token = localStorage.getItem("arxiva-auth-token");
        if (token) {
          const res = await fetch(`${getBaseUrl()}/auth/google/status`, {
            headers: { Authorization: token }
          });
          const data = await res.json();
          if (data.connected) {
            setIsGoogleConnected(true);
            setGoogleEmail(data.email || "");
          } else {
            setIsGoogleConnected(false);
          }
        }
      } catch (error) {
        console.error("Gagal memeriksa status koneksi Google:", error);
      }
    };

    /**
     * Mengambil Folder ID yang tersimpan (biasanya untuk admin, tapi kita bisa buat global)
     */
    const fetchDriveFolderId = async () => {
      try {
        setIsLoadingFolderId(true);
        // Panggil endpoint pengaturan sistem
        // Untuk sekarang, kita gunakan endpoint /api/settings/drive-folder
        // Pastikan endpoint ini tersedia di backend (atau gunakan preferensi pengguna jika global)
        const token = localStorage.getItem("arxiva-auth-token");
        if (token) {
          // Asumsi ada endpoint untuk ini
          const res = await fetch(`${getBaseUrl()}/settings/drive-folder`, {
            headers: { Authorization: token }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.folderId) {
              setDriveFolderId(data.folderId);
            }
          }
        }
      } catch (error) {
        console.error("Gagal mengambil Drive Folder ID:", error);
      } finally {
        setIsLoadingFolderId(false);
      }
    }

    checkGoogleConnection();
    fetchDriveFolderId();
  }, []);

  /**
   * Menyimpan konfigurasi ID Folder Drive ke backend.
   * Hanya Admin yang diizinkan untuk mengubah pengaturan sistem ini.
   */
  const handleSaveDriveFolderId = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error("Hanya Admin yang dapat menyimpan Folder ID.");
      return;
    }

    if (!driveFolderId.trim()) {
      toast.error("Folder ID tidak boleh kosong.");
      return;
    }

    setIsSavingFolderId(true);
    try {
      const token = localStorage.getItem("arxiva-auth-token");
      if (token) {
        const res = await fetch(`${getBaseUrl()}/settings/drive-folder`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token
          },
          body: JSON.stringify({ folderId: driveFolderId.trim() })
        });

        if (res.ok) {
          toast.success("Drive Folder ID berhasil disimpan.");
          setIsInputActive(false); // Lock input again
        } else {
          toast.error("Gagal menyimpan Drive Folder ID.");
        }
      }
    } catch (error) {
      toast.error("Terjadi kesalahan saat menyimpan Folder ID.");
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
    // Set cookie state to redirect back to settings after auth
    document.cookie = "auth_redirect=/pengaturan; path=/";

    // Inisiasi OAuth flow dengan backend (bukan Tauri invoke)
    // Backend akan redirect ke halaman Google Consent
    setIsConnecting(true);
    try {
      const token = localStorage.getItem("arxiva-auth-token");
      if (token) {
        // Panggil endpoint yang akan mengembalikan URL OAuth Google
        const res = await fetch(`${getBaseUrl()}/auth/google`, {
          headers: { Authorization: token }
        });
        const data = await res.json();

        if (data.url) {
          // Buka URL di browser pengguna
          window.location.href = data.url;
        } else {
          toast.error("Gagal mendapatkan URL otentikasi Google.");
        }
      }
    } catch (error) {
      toast.error("Gagal memulai proses koneksi Google.");
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
    <div className="@container/main flex h-full select-none flex-col gap-6 w-full mx-auto overflow-hidden">
      {/* Main Content Layout */}
      <div className="flex flex-col lg:flex-row lg:space-y-0 flex-1 overflow-hidden">
        <aside className="lg:w-1/5 shrink-0 overflow-y-auto pb-10 border-r">
          <div className="border-b px-6 py-3">
            <span className="text-md font-medium">Settings</span>
          </div>
          <SidebarNav
            groups={sidebarGroups}
            activeId={activeCategory}
            onSelect={setActiveCategory}
            isAdmin={isAdmin}
          />
        </aside>

        <div className="flex-1 w-full overflow-y-auto pb-10 px-8">
          {activeCategory === "profil" && (
            <div className="flex flex-col gap-6">
              <ProfileTab />
            </div>
          )}

          {activeCategory === "keamanan" && (
            <div className="flex flex-col gap-6">
              <SecurityTab />
            </div>
          )}

          {activeCategory === "ttd-digital" && (
            <div className="flex flex-col gap-6">
              <SignatureTab />
            </div>
          )}

          {activeCategory === "google-drive" && (
            <div className="px-2 pt-14">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-medium">Integrasi & Cloud</h1>
                  <span className="text-sm text-muted-foreground">Kelola layanan pihak ketiga yang terhubung dengan sistem</span>
                </div>
              </div>

              <div className="mt-6 space-y-6">
                <h1 className="text-lg font-medium flex items-center gap-2">
                  <Cloud className="size-5 text-primary" /> Google Workspace
                </h1>
                
                <Card className="rounded-sm p-0! shadow-sm overflow-hidden mb-6">
                  {/* Header & OAuth Section */}
                  <div className="p-6 border-b border-border/50 bg-card">
                    <div className="flex items-start justify-between mb-6">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-medium">Autentikasi Akun</h2>
                          {!isAdmin && <Badge variant="secondary" className="text-xs font-normal">Akses Admin</Badge>}
                        </div>
                      <p className="text-muted-foreground text-sm leading-relaxed max-w-xl">
                        Hubungkan sistem dengan Google Workspace untuk sinkronisasi penyimpanan dokumen BAST dan layanan cloud lainnya.
                      </p>
                    </div>
                    
                    <div>
                      {isGoogleConnected ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleDisconnectGoogle}
                          disabled={!isAdmin || isDisconnecting}
                          className="gap-2 text-xs shadow-sm h-9"
                        >
                          {isDisconnecting ? <RefreshCw className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
                          Putuskan Tautan
                        </Button>
                      ) : (
                        <Button
                          onClick={handleConnectGoogle}
                          disabled={!isAdmin || isConnecting}
                          size="sm"
                          className="gap-2 text-xs shadow-sm h-9"
                        >
                          {isConnecting ? <RefreshCw className="size-3.5 animate-spin" /> : <Cloud className="size-3.5" />}
                          Hubungkan Google
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="w-full">
                    {isGoogleConnected ? (
                      <div className="flex items-center gap-4 rounded-xl border bg-gradient-to-r from-emerald-500/10 via-background to-background p-4 shadow-sm backdrop-blur-sm relative overflow-hidden">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                          <CheckCircle2 className="size-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-foreground tracking-tight">Akun Terhubung</span>
                          <span className="text-xs text-muted-foreground">{googleEmail}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/40 p-6 text-center">
                        <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <AlertCircle className="size-5" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">Google OAuth2 Belum Terhubung</p>
                          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                            Anda harus menghubungkan akun Google Admin terlebih dahulu sebelum dapat mengkonfigurasi pengaturan Drive.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Drive Folder Configuration Section */}
                <div className={`p-6 transition-opacity duration-300 ${!isGoogleConnected ? 'opacity-50 pointer-events-none select-none' : ''}`}>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 space-y-1">
                      <h3 className="text-sm font-medium">Root Folder ID</h3>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        Tentukan ID dari folder Google Drive tempat semua dokumen BAST akan disimpan.
                      </p>
                    </div>

                    <div className="md:col-span-2 flex w-full">
                      <div className="space-y-3 w-full">
                        <div className="relative">
                          <Input
                            id="driveFolderId"
                            value={driveFolderId}
                            onChange={(e) => setDriveFolderId(e.target.value)}
                            disabled={!isAdmin || isLoadingFolderId || isSavingFolderId || !isInputActive || !isGoogleConnected}
                            className="p-5 pr-12 bg-background"
                            placeholder={isGoogleConnected ? "Masukkan Folder ID" : "Hubungkan Google terlebih dahulu"}
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => setIsInputActive(!isInputActive)}
                            disabled={!isAdmin || isLoadingFolderId || isSavingFolderId || !isGoogleConnected}
                            className="absolute right-2 top-1 text-muted-foreground hover:text-foreground"
                          >
                            {isInputActive ? <Unlock className="size-4" /> : <Lock className="size-4" />}
                          </Button>
                        </div>
                        
                        {!isGoogleConnected && (
                          <p className="text-xs text-amber-600 dark:text-amber-500 font-medium flex items-center gap-1.5 mt-2">
                            <AlertCircle className="size-3.5" /> Konfigurasi ini terkunci karena OAuth2 belum terhubung.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Save Button */}
                <div className="bg-muted/40 px-6 py-4 flex items-center justify-end border-t border-border/50">
                  <Button 
                    onClick={handleSaveDriveFolderId} 
                    disabled={!isAdmin || isLoadingFolderId || isSavingFolderId || !isGoogleConnected} 
                    className="gap-2"
                  >
                    {isSavingFolderId ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Simpan Konfigurasi
                  </Button>
                </div>

                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
