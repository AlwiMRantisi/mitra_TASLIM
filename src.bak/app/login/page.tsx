import { useState, type FormEvent } from "react"
import { Eye, EyeOff, LockKeyhole, PackageSearch, UserRound, Loader2 } from "lucide-react"
import { Navigate, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth"

/**
 * Halaman Utama Login (LoginPage)
 * 
 * Komponen ini menangani antarmuka autentikasi pengguna. Menghubungkan form login
 * ke fungsi `login` dari context autentikasi global (`useAuth`).
 *
 * @returns {JSX.Element} Antarmuka halaman login.
 */
export default function LoginPage() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (user) {
    return <Navigate to="/" replace />
  }

  /**
   * Menangani aksi submit pada form login.
   * Melakukan validasi input dasar, menampilkan loading state, dan memanggil fungsi autentikasi.
   * 
   * @param {FormEvent<HTMLFormElement>} event - Event default dari form HTML
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    // Mencegah reload halaman secara default
    event.preventDefault()
    setErrorMessage("")

    if (!username.trim() || !password) {
      setErrorMessage("Username dan password wajib diisi.")
      return
    }

    setIsSubmitting(true)
    try {
      // Memanggil fungsi login dari AuthContext (API Call)
      await login(username.trim(), password)
      
      // Jika berhasil, arahkan pengguna kembali ke halaman utama (dashboard)
      navigate("/", { replace: true })
    } catch (error) {
      // Tangkap dan tampilkan error kembalian dari API ke pengguna
      setErrorMessage(
        typeof error === "string"
          ? error
          : "Login gagal. Periksa kembali username dan password."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,var(--color-primary)_0,transparent_28%)] opacity-15" />
      <div className="absolute -right-24 -top-24 size-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-32 -left-20 size-96 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative grid w-full max-w-110 overflow-hidden rounded-xl border bg-card shadow-2xl">
        <Card className="rounded-none border-0 bg-transparent py-8 shadow-none sm:py-12">
          <CardHeader className="px-6 sm:px-10">
            <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary md:hidden">
              <PackageSearch className="size-6" />
            </div>
            <CardTitle className="text-2xl">Masuk ke Arxiva</CardTitle>
            <CardDescription>
              Gunakan akun Admin atau Mitra yang telah terdaftar.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 sm:px-10">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <UserRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                    autoFocus
                    placeholder="Masukkan username"
                    className="h-11 pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="Masukkan password"
                    className="h-11 px-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={
                      showPassword ? "Sembunyikan password" : "Tampilkan password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              {errorMessage && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {errorMessage}
                </p>
              )}

              <Button className="h-11 w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Memeriksa akun...
                  </>
                ) : (
                  "Masuk"
                )}
              </Button>

              <p className="text-center text-xs leading-5 text-muted-foreground">
                Tidak tersedia pendaftaran mandiri. Akun mitra hanya dapat
                dibuat oleh administrator.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
