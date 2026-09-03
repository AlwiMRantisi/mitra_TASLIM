export type RequestItem = {
	id: number | string
	category: string
	brand: string
	quantity: number
	unit: string
}

export type InterPartnerRequest = {
	id: string
	requestNumber: string
	requesterPartnerId: string
	providerPartnerId: string
	requesterName: string
	providerName: string
	itemsCount: number
	itemsDetail: string
	status: string
	notes?: string
	requestedAt: string
	requestItems: RequestItem[]
	deliveryDocument?: {
		kpSignedById?: string | null
		picSignedById?: string | null
		driveViewUrl?: string | null
	} | null
}

export type InterPartnerStatus =
	| "menunggu_persetujuan"
	| "menunggu_scan_pemberi"
	| "menunggu_scan_penerima"
	| "siap"
	| "selesai"
	| "diterima"
	| "ditolak"
	| "dibatalkan"

export const INTER_PARTNER_STATUS_LABEL: Record<InterPartnerStatus, string> = {
	menunggu_persetujuan: "Menunggu Persetujuan Admin",
	menunggu_scan_pemberi: "Menunggu Scan Pemberi",
	menunggu_scan_penerima: "Menunggu Scan Penerima",
	siap: "Siap Serah Terima",
	selesai: "Selesai",
	diterima: "Diterima",
	ditolak: "Ditolak",
	dibatalkan: "Dibatalkan",
}

export const PENDING_APPROVAL_STATUSES: readonly string[] = [
	"menunggu_persetujuan",
	"menunggu",
	"pending",
	"menunggu_persetujuan_admin",
	"PENDING",
	"MENUNGGU",
	"MENUNGGU_PERSETUJUAN",
]
