export function formatItemStatus(status: string | undefined | null, role: string | undefined | null): string {
  if (!status) return "-";
  
  const normalizedStatus = status.trim().toLowerCase();
  
  if (normalizedStatus === "diluar" || normalizedStatus === "terdistribusi") {
    if (role === "mitra") {
      return "Tersedia";
    }
    // For KP admin or other roles, it's considered distributed
    return "Terdistribusi";
  }
  
  // Capitalize first letter for other statuses
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function formatItemLocation(lokasiPenyimpanan: string | undefined | null, mitra: string | undefined | null): string {
  if (!lokasiPenyimpanan) return "-";
  
  const normalizedLokasi = lokasiPenyimpanan.trim().toLowerCase();
  
  if ((normalizedLokasi === "mitra" || normalizedLokasi === "terdistribusi" || normalizedLokasi === "diluar" || normalizedLokasi === "keluar") && mitra) {
    return mitra;
  }
  
  return lokasiPenyimpanan.trim();
}
