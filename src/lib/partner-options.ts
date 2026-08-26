import type { Partner, PartnerType } from "@/types/partner"

type RawRecord = Record<string, unknown>

type NormalizePartnerOptions = {
  activeOnly?: boolean
  excludeIds?: Array<string | number | null | undefined>
  excludeNames?: Array<string | null | undefined>
  requireMitraRole?: boolean
  requireAdminRole?: boolean
}

const COLLECTION_KEYS = [
  "data",
  "users",
  "partners",
  "mitras",
  "items",
  "results",
  "rows",
  "records",
  "list",
]

const asRecord = (value: unknown): RawRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as RawRecord) : {}

const normalizeText = (value: unknown) => {
  if (value === null || value === undefined || typeof value === "object") return ""
  return String(value).trim()
}

const normalizeKey = (value: unknown) => normalizeText(value).toLowerCase()

const readFirstText = (...values: unknown[]) => {
  for (const value of values) {
    const text = normalizeText(value)
    if (text) return text
  }
  return ""
}

const readBoolean = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "boolean") return value
    if (typeof value === "number") return value !== 0
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase()
      if (["true", "1", "aktif", "active", "enabled", "yes"].includes(normalized)) return true
      if (["false", "0", "nonaktif", "inactive", "disabled", "no"].includes(normalized)) return false
    }
  }

  return undefined
}

export const unwrapPartnerCollection = (value: unknown, depth = 0): unknown[] => {
  if (Array.isArray(value)) return value
  if (depth >= 4) return []

  const payload = asRecord(value)
  for (const key of COLLECTION_KEYS) {
    const nested = payload[key]
    const collection = unwrapPartnerCollection(nested, depth + 1)
    if (collection.length > 0) return collection
  }

  for (const nested of Object.values(payload)) {
    const collection = unwrapPartnerCollection(nested, depth + 1)
    if (collection.length > 0) return collection
  }

  return []
}

type NormalizeRoleOptions = { requireMitraRole: boolean; requireAdminRole: boolean }

const normalizePartner = (value: unknown, roleOptions: NormalizeRoleOptions): Partner | null => {
  const rec = asRecord(value)
  if (Object.keys(rec).length === 0) return null

  const profile = asRecord(rec.profile)
  const partner = asRecord(rec.partner ?? rec.mitra ?? rec.partnerProfile)
  const role = normalizeKey(readFirstText(rec.role, profile.role, partner.role))
  const hasKnownRole = Boolean(role)
  const isMitraRole = role === "mitra" || role === "partner"
  const isAdminRole = role === "admin" || role === "kp" || role === "kantor pusat"

  if (roleOptions.requireAdminRole) {
    if (hasKnownRole && !isAdminRole) return null
    if (!hasKnownRole && roleOptions.requireAdminRole) return null
  } else if (roleOptions.requireMitraRole) {
    if ((hasKnownRole && !isMitraRole)) return null
  } else {
    if (hasKnownRole && !isMitraRole && !isAdminRole) return null
  }

  const id = readFirstText(
    rec.id,
    rec.userId,
    rec.partnerId,
    rec._id,
    profile.id,
    partner.id,
    rec.code,
    profile.code,
    profile.kode,
    rec.username,
    rec.name,
    rec.nama,
  )

  const name = readFirstText(
    profile.nama,
    profile.name,
    profile.displayName,
    partner.partnerName,
    partner.name,
    partner.nama,
    rec.partnerName,
    rec.displayName,
    rec.name,
    rec.nama,
    rec.username,
    id,
  )

  if (!id || !name) return null

  const code = readFirstText(
    profile.code,
    profile.kode,
    profile.identityCode,
    rec.code,
    rec.kode,
    rec.identityCode,
    rec.identity_code,
    partner.code,
    partner.kode,
  )

  const partnerType = readFirstText(
    profile.partnerType,
    profile.type,
    partner.partnerType,
    partner.type,
    rec.partnerType,
    rec.type,
  ) as PartnerType

  return {
    id,
    code: code || undefined,
    name,
    partnerType: partnerType || undefined,
    contactPerson: readFirstText(profile.contactPerson, profile.picName, rec.contactPerson, rec.picName) || "-",
    phone: readFirstText(profile.telepon, profile.phone, rec.telepon, rec.phone) || "-",
    email: readFirstText(profile.email, rec.email) || "-",
    address: readFirstText(profile.alamat, profile.address, rec.alamat, rec.address) || "-",
    isActive: readBoolean(rec.isAktif, rec.isActive, rec.active, profile.isAktif, profile.isActive, rec.status) ?? true,
    username: readFirstText(rec.username, profile.username) || null,
  }
}

export const normalizePartnerList = (
  value: unknown,
  options: NormalizePartnerOptions = {},
): Partner[] => {
  const excludeIds = new Set((options.excludeIds ?? []).map(normalizeKey).filter(Boolean))
  const excludeNames = new Set((options.excludeNames ?? []).map(normalizeKey).filter(Boolean))
  const unique = new Map<string, Partner>()
  const roleOptions: NormalizeRoleOptions = {
    requireMitraRole: options.requireMitraRole ?? false,
    requireAdminRole: options.requireAdminRole ?? false,
  }

  for (const item of unwrapPartnerCollection(value)) {
    const partner = normalizePartner(item, roleOptions)
    if (!partner) continue
    if (options.activeOnly && !partner.isActive) continue

    const identityKeys = [partner.id, partner.code, partner.username].map(normalizeKey).filter(Boolean)
    const nameKeys = [partner.name, partner.username].map(normalizeKey).filter(Boolean)

    if (identityKeys.some((key) => excludeIds.has(key))) continue
    if (nameKeys.some((key) => excludeNames.has(key))) continue

    const uniqueKey = normalizeKey(partner.id) || normalizeKey(partner.code) || normalizeKey(partner.name)
    if (!unique.has(uniqueKey)) {
      unique.set(uniqueKey, partner)
    }
  }

  return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name))
}
