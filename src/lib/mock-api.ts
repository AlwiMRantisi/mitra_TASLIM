/**
 * mock-api.ts
 *
 * Mock handler untuk endpoint /requests saat uji coba lokal.
 * Aktif ketika VITE_USE_MOCK=true di .env.local
 *
 * Cara pakai:
 *   1. Buat file .env.local di root project
 *   2. Tambahkan: VITE_USE_MOCK=true
 *   3. Jalankan dev server → semua panggilan api ke /requests
 *      akan dijawab dari dummy-requests.json tanpa menyentuh server
 *
 * Endpoint yang di-mock:
 *   GET    /requests              → daftar semua request
 *   GET    /requests/:id          → detail satu request
 *   POST   /requests              → buat request baru (in-memory)
 *   PUT    /requests/:id/status   → ubah status (in-memory)
 *   DELETE /requests/:id          → hapus request (in-memory)
 *   POST   /requests/:id/sign     → tanda tangan (in-memory)
 */

import dummyRequests from "@/data/dummy-requests.json"

// ── In-memory store — diisi saat pertama kali mock dipakai ──────────────────
let store: any[] = structuredClone(dummyRequests)
let nextId = 100

// ── Helper ───────────────────────────────────────────────────────────────────

const ok = (data: unknown, status = 200) =>
  Promise.resolve({ data, status, headers: new Headers({ "content-type": "application/json" }) })

const notFound = () =>
  Promise.reject(Object.assign(new Error("Not found"), { response: { status: 404, data: { message: "Not found" } } }))

const generateRequestNumber = () => {
  const now = new Date()
  const dateStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("")
  nextId++
  return `REQ-${dateStr}-${String(nextId).padStart(4, "0")}`
}

// ── Route matcher ─────────────────────────────────────────────────────────────

/**
 * Intercepts calls to the api.* methods when VITE_USE_MOCK=true.
 * Returns null if the endpoint is not mocked (caller falls through to real API).
 */
export function mockRequest(
  method: string,
  endpoint: string,
  body?: unknown
): Promise<{ data: unknown; status: number; headers: Headers }> | null {
  const m = method.toUpperCase()

  // GET /requests
  if (m === "GET" && /^\/requests\/?$/.test(endpoint)) {
    return ok(store)
  }

  // GET /requests/:id
  const detailMatch = endpoint.match(/^\/requests\/([^/]+)\/?$/)
  if (m === "GET" && detailMatch) {
    const id = detailMatch[1]
    const req = store.find((r) => r.id === id)
    return req ? ok(req) : notFound()
  }

  // POST /requests  — buat request baru
  if (m === "POST" && /^\/requests\/?$/.test(endpoint)) {
    const payload = body as any
    const newRequest = {
      id: `req-${Date.now()}`,
      requestNumber: generateRequestNumber(),
      requesterId: payload.requesterId ?? "mitra-local",
      requester: {
        id: payload.requesterId ?? "mitra-local",
        username: "mitra_local",
        profile: {
          nama: "Mitra Lokal",
          partnerType: "ISP",
          identityCode: "MTR-LOCAL",
        },
      },
      status: "Menunggu",
      notes: payload.notes ?? "",
      adminRemarks: null,
      requestedAt: new Date().toISOString(),
      requestedDeliveryDate: null,
      itemsCount: (payload.items ?? []).reduce((s: number, i: any) => s + (i.quantity ?? 1), 0),
      requestItems: (payload.items ?? []).map((item: any, idx: number) => ({
        id: idx + 1,
        quantity: item.quantity ?? 1,
        materialCategory: {
          id: item.materialCategoryId ?? idx + 1,
          nama: `Kategori ${item.materialCategoryId ?? idx + 1}`,
        },
        brand: {
          id: item.brandId ?? idx + 1,
          nama: `Merek ${item.brandId ?? idx + 1}`,
        },
        model: null,
        allocations: [],
      })),
      deliveryDocument: null,
    }
    store = [newRequest, ...store]
    return ok(newRequest, 201)
  }

  // PUT /requests/:id/status
  const statusMatch = endpoint.match(/^\/requests\/([^/]+)\/status\/?$/)
  if (m === "PUT" && statusMatch) {
    const id = statusMatch[1]
    const idx = store.findIndex((r) => r.id === id)
    if (idx === -1) return notFound()
    const newStatus = (body as any)?.status ?? store[idx].status
    store[idx] = { ...store[idx], status: newStatus }
    return ok(store[idx])
  }

  // DELETE /requests/:id
  if (m === "DELETE" && detailMatch) {
    const id = detailMatch![1]
    const before = store.length
    store = store.filter((r) => r.id !== id)
    return store.length < before ? ok({ message: "Deleted" }) : notFound()
  }

  // POST /requests/:id/sign
  const signMatch = endpoint.match(/^\/requests\/([^/]+)\/sign\/?$/)
  if (m === "POST" && signMatch) {
    const id = signMatch[1]
    const idx = store.findIndex((r) => r.id === id)
    if (idx === -1) return notFound()
    store[idx] = {
      ...store[idx],
      deliveryDocument: {
        ...(store[idx].deliveryDocument ?? {}),
        picSignedById: "local-user",
      },
    }
    return ok(store[idx])
  }

  // Endpoint tidak di-mock → kembalikan null supaya caller pakai API asli
  return null
}

// ── Flag helper ───────────────────────────────────────────────────────────────

export const isMockEnabled = () =>
  import.meta.env.VITE_USE_MOCK === "true" || import.meta.env.VITE_USE_MOCK === "1"
