import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";

export function ProfileTab() {
  const { user, updateUser } = useAuth();

  const originalPicName = user?.profile?.picName || user?.displayName || "";
  const originalUsername = user?.username || "";
  
  const [picName, setPicName] = useState(originalPicName);
  const [username, setUsername] = useState(originalUsername);
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = picName !== originalPicName || username !== originalUsername;

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const res = await api.put(`/users/${user.id}`, {
        username,
        picName
      });

      if (res.data) {
        updateUser({
          ...user,
          username,
          profile: {
            ...user.profile,
            picName,
          }
        });
        toast.success("Profil berhasil disimpan");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Gagal menyimpan profil");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="px-2 pt-14">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium">Profil Anda</h1>
          <span className="text-sm text-muted-foreground">Kelola informasi identitas Anda</span>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <h1 className="text-lg font-medium">Informasi Akun</h1>
        <Card className="rounded-sm p-0!">
          <CardContent className="p-0!">
            <div className="flex flex-wrap justify-between p-4">
              <h2 className="font-medium text-sm">Username</h2>
              <Input type="text" value={username} className="max-w-md h-9 rounded-sm" onChange={(e) => setUsername(e.target.value)} />
            </div>
            <Separator />
            <div className="flex flex-wrap justify-between p-4">
              <h2 className="font-medium text-sm">Nama / Person In Charge</h2>
              <Input type="text" value={picName} className="max-w-md h-9 rounded-sm" onChange={(e) => setPicName(e.target.value)} />
            </div>
            <div className="w-full flex items-center justify-end gap-2 p-4 border-t border-border/50">
              <Button className="active:translate-y-0!" size="sm" variant="outline" onClick={() => { setPicName(originalPicName); setUsername(originalUsername); }} disabled={!hasChanges || isSaving}>
                Batal
              </Button>
              <Button className="active:translate-y-0!" size="sm" variant="default" disabled={!hasChanges || isSaving} onClick={handleSaveProfile}>
                {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
