import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

export function SecurityTab() {
  const { user } = useAuth();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = oldPassword || newPassword || confirmPassword;

  const handleSavePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error("Semua kolom harus diisi");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Kata sandi baru dan konfirmasi tidak cocok");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Kata sandi baru minimal 6 karakter");
      return;
    }

    setIsSaving(true);
    try {
      if (!user) {
        toast.error("User tidak ditemukan");
        return;
      }

      // 1. Verify old password using login endpoint
      try {
        await api.post('/auth/login', {
          username: user.username,
          password: oldPassword
        });
      } catch (authError: any) {
        toast.error("Kata sandi lama salah");
        return;
      }

      // 2. Update to new password
      await api.put(`/users/${user.id}`, {
        password: newPassword
      });
      
      toast.success("Kata sandi berhasil diperbarui");
      
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || "Gagal mengubah kata sandi");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="px-2 pt-14">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium">Keamanan</h1>
          <span className="text-sm text-muted-foreground">Kelola kata sandi akun Anda</span>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <h1 className="text-lg font-medium">Ubah Kata Sandi</h1>
        <Card className="rounded-sm p-0!">
          <CardContent className="p-0!">
            <div className="flex flex-wrap justify-between p-4">
              <h2 className="font-medium text-sm">Kata Sandi Saat Ini</h2>
              <Input type="password" value={oldPassword} placeholder="Masukkan kata sandi saat ini" className="max-w-md h-9 rounded-sm" onChange={(e) => setOldPassword(e.target.value)} />
            </div>
            <Separator />
            <div className="flex flex-wrap justify-between p-4">
              <h2 className="font-medium text-sm">Kata Sandi Baru</h2>
              <Input type="password" value={newPassword} placeholder="Masukkan kata sandi baru" className="max-w-md h-9 rounded-sm" onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <Separator />
            <div className="flex flex-wrap justify-between p-4">
              <h2 className="font-medium text-sm">Konfirmasi Kata Sandi Baru</h2>
              <Input type="password" value={confirmPassword} placeholder="Ketik ulang kata sandi baru" className="max-w-md h-9 rounded-sm" onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <div className="w-full flex items-center justify-end gap-2 p-4 border-t border-border/50">
              <Button className="active:translate-y-0!" size="sm" variant="outline" onClick={() => { setOldPassword(""); setNewPassword(""); setConfirmPassword(""); }} disabled={!hasChanges || isSaving}>
                Batal
              </Button>
              <Button className="active:translate-y-0!" size="sm" variant="default" disabled={!hasChanges || isSaving} onClick={handleSavePassword}>
                {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                {isSaving ? "Menyimpan..." : "Perbarui Kata Sandi"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
