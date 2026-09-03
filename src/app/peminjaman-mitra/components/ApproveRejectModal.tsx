import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

type Decision = "approve" | "reject"

interface ApproveRejectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  decision: Decision
  requestNumber: string
  requesterName: string
  providerName: string
  isSubmitting?: boolean
  onConfirm: (rejectionNotes?: string) => void
}

export function ApproveRejectModal({
  open,
  onOpenChange,
  decision,
  requestNumber,
  requesterName,
  providerName,
  isSubmitting = false,
  onConfirm,
}: ApproveRejectModalProps) {
  const [note, setNote] = useState("")

  useEffect(() => {
    if (open) setNote("")
  }, [open])

  const isApprove = decision === "approve"

  const handleConfirm = () => {
    onConfirm(isApprove ? undefined : note.trim())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isApprove ? "Setujui Peminjaman Antar Mitra" : "Tolak Peminjaman Antar Mitra"}
          </DialogTitle>
          <DialogDescription>
            {isApprove
              ? `Setujui permintaan ${requestNumber} dari ${requesterName} kepada ${providerName}? Mitra pemberi kemudian wajib melakukan scan barang.`
              : `Tolak permintaan ${requestNumber} dari ${requesterName} kepada ${providerName}? Permintaan akan berstatus Ditolak.`}
          </DialogDescription>
        </DialogHeader>

        {!isApprove && (
          <div className="space-y-1.5">
            <Label htmlFor="rejection-note">Catatan Penolakan (opsional)</Label>
            <Textarea
              id="rejection-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={`Masukkan alasan penolakan untuk ${requestNumber}...`}
            />
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            className="cursor-pointer"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button
            variant={isApprove ? "default" : "destructive"}
            className="cursor-pointer"
            disabled={isSubmitting}
            onClick={handleConfirm}
          >
            {isApprove ? "Setujui" : "Tolak"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
