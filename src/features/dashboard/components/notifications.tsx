"use client"

import * as React from "react"
import { Bell, Check, Info, AlertTriangle, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth"

type NotificationItem = {
  id: string
  title: string
  message: string
  type: string
  date: string
  isRead: boolean
}

const ITEMS_PAGE_LIMIT = 1000
const MAX_ITEM_PAGES = 100

const getBaseUrl = () => {
  const baseUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_URL || import.meta.env.URL || "https://api-taslim.duckdns.org/"
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
}

const getHeaders = () => {
  const token = localStorage.getItem("arxiva-auth-token")
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (token) {
    headers["Authorization"] = `${token}`
  }
  return headers
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const unwrapList = (value: unknown): any[] => {
  if (Array.isArray(value)) return value

  const payload = asRecord(value)
  for (const key of ["data", "items", "results", "rows", "records"]) {
    if (Array.isArray(payload[key])) return payload[key] as any[]
  }

  return []
}

const readNumber = (value: unknown) => {
  const numberValue = typeof value === "number" ? value : Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

const normalizeText = (value: unknown) => {
  if (value === null || value === undefined || typeof value === "object") return ""
  return String(value).trim()
}

const normalizeLookupKey = (value: unknown) =>
  normalizeText(value)
    .toLocaleLowerCase("id-ID")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

const pushTextKey = (keys: Set<string>, value: unknown) => {
  const key = normalizeLookupKey(value)
  if (key) keys.add(key)
}

const pushIdKey = (keys: Set<string>, value: unknown) => {
  const text = normalizeText(value)
  if (text) keys.add(`id:${text}`)
}

const getCategoryKeys = (category: any) => {
  const keys = new Set<string>()
  const cat = asRecord(category)

  pushIdKey(keys, cat.id)
  pushTextKey(keys, cat.name)
  pushTextKey(keys, cat.nama)
  pushTextKey(keys, cat.label)

  return keys
}

const getItemCategoryKeys = (item: any) => {
  const keys = new Set<string>()
  const rec = asRecord(item)
  const materialCategory = asRecord(rec.materialCategory)
  const category = asRecord(rec.category)

  pushIdKey(keys, rec.materialCategoryId)
  pushIdKey(keys, rec.categoryId)
  pushIdKey(keys, materialCategory.id)
  pushIdKey(keys, category.id)
  pushTextKey(keys, rec.kategori)
  pushTextKey(keys, rec.category)
  pushTextKey(keys, rec.categoryName)
  pushTextKey(keys, materialCategory.nama)
  pushTextKey(keys, materialCategory.name)
  pushTextKey(keys, category.nama)
  pushTextKey(keys, category.name)

  return keys
}

const isCategoryMatch = (item: any, category: any) => {
  const categoryKeys = getCategoryKeys(category)
  const itemKeys = getItemCategoryKeys(item)

  for (const key of categoryKeys) {
    if (itemKeys.has(key)) return true
  }

  const textCategoryKeys = Array.from(categoryKeys).filter((key) => !key.startsWith("id:"))
  const textItemKeys = Array.from(itemKeys).filter((key) => !key.startsWith("id:"))

  return textCategoryKeys.some((categoryKey) =>
    categoryKey.length >= 3 &&
    textItemKeys.some((itemKey) => itemKey === categoryKey || itemKey.includes(categoryKey))
  )
}

const isSafetyStockNotification = (notification: NotificationItem) => {
  const text = `${notification.title} ${notification.message}`.toLocaleLowerCase("id-ID")
  return notification.id.startsWith("local-ss-") || text.includes("stok kritis")
}

const getPaginationTotalPages = (payload: unknown, itemCount: number) => {
  const response = asRecord(payload)
  const pagination = asRecord(response.pagination ?? response.meta)
  const totalPages = readNumber(
    pagination.totalPages ??
    pagination.total_pages ??
    pagination.pageCount ??
    pagination.pages
  )
  if (totalPages && totalPages > 0) return Math.min(totalPages, MAX_ITEM_PAGES)

  const totalItems = readNumber(
    pagination.totalItems ??
    pagination.total_items ??
    pagination.total ??
    response.totalItems ??
    response.total
  )
  if (totalItems && totalItems > itemCount) {
    return Math.min(Math.ceil(totalItems / ITEMS_PAGE_LIMIT), MAX_ITEM_PAGES)
  }

  return null
}

const fetchItemsPage = async (page: number) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(ITEMS_PAGE_LIMIT),
  })
  const res = await fetch(`${getBaseUrl()}/items?${params.toString()}`, {
    method: "GET",
    headers: getHeaders(),
  })
  if (!res.ok) throw new Error("Gagal memuat data barang")

  const payload = await res.json()
  const items = unwrapList(payload)

  return {
    items,
    totalPages: getPaginationTotalPages(payload, items.length),
  }
}

const fetchAllItems = async () => {
  const firstPage = await fetchItemsPage(1)
  const allItems = [...firstPage.items]

  if (firstPage.totalPages) {
    const restPages = Array.from({ length: firstPage.totalPages - 1 }, (_, index) => index + 2)
    const restResults = await Promise.all(restPages.map(fetchItemsPage))
    restResults.forEach((result) => allItems.push(...result.items))
    return allItems
  }

  let page = 1
  let lastCount = firstPage.items.length
  while (lastCount === ITEMS_PAGE_LIMIT && page < MAX_ITEM_PAGES) {
    page += 1
    const result = await fetchItemsPage(page)
    allItems.push(...result.items)
    lastCount = result.items.length
  }

  return allItems
}

const isAvailableForSafetyStock = (item: any, role?: string) => {
  const status = normalizeLookupKey(item.status)
  if (status === "tersedia") return true

  if (role === "mitra") {
    return status === "diluar" || status === "terdistribusi"
  }

  return false
}

export function Notifications() {
  const { user } = useAuth()
  const [open, setOpen] = React.useState(false)
  const [items, setItems] = React.useState<NotificationItem[]>([])
  const hasCheckedSafetyStockRef = React.useRef(false)

  // ── Fetch server notifications ──────────────────────────────────────────────
  const fetchNotifications = React.useCallback(async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/notifications`, {
        method: "GET",
        headers: getHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.data)) {
          const mapped = data.data
            .map((n: any) => ({
              ...n,
              date: n.createdAt || n.date
            }))
            .filter((n: NotificationItem) =>
              !hasCheckedSafetyStockRef.current || !isSafetyStockNotification(n)
            )
          setItems((prev) => {
            const localItems = prev.filter((n) => n.id.startsWith("local-ss-"))
            const serverIds = new Set(mapped.map((n: NotificationItem) => n.id))
            const filteredLocal = localItems.filter((n) => !serverIds.has(n.id))
            return [...filteredLocal, ...mapped]
          })
        }
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error)
    }
  }, [])

  // ── Safety stock check — scoped per akun ────────────────────────────────────
  // Keduanya (admin dan mitra) menghitung dari /items secara langsung,
  // hanya menghitung item yang status = "tersedia" agar akurat.
  const checkSafetyStock = React.useCallback(async () => {
    if (!user) return
    try {
      // Fetch categories (coba dua endpoint)
      const endpoints = ["/categories", "/material-categories"]
      let rawCategories: any[] = []
      for (const endpoint of endpoints) {
        try {
          const res = await fetch(`${getBaseUrl()}${endpoint}`, {
            method: "GET",
            headers: getHeaders(),
          })
          if (res.ok) {
            const data = await res.json()
            const list = Array.isArray(data)
              ? data
              : Array.isArray(data?.data) ? data.data : []
            if (list.length > 0) { rawCategories = list; break }
          }
        } catch { continue }
      }
      if (rawCategories.length === 0) return

      // Fetch semua items lalu hitung stok "tersedia" per kategori
      // Admin: semua item gudang
      // Mitra: hanya item milik akun ini
      let stockPerCategory: Map<string, number> = new Map()

      try {
        const allItems = await fetchAllItems()
        const myName = user.displayName?.trim().toLowerCase() ?? ""
        const myUsername = user.username?.trim().toLowerCase() ?? ""
        const myCode = user.identityCode?.trim().toLowerCase() ?? ""

        const visibleItems = user.role === "mitra"
          ? allItems.filter((item: any) => {
              const itemMitra = (item.mitra ?? "").trim().toLowerCase()
              return (
                (myName && itemMitra === myName) ||
                (myUsername && itemMitra === myUsername) ||
                (myCode && itemMitra.includes(myCode))
              )
            })
          : allItems

        const availableItems = visibleItems.filter((item: any) =>
          isAvailableForSafetyStock(item, user.role)
        )

        stockPerCategory = new Map(
          rawCategories.map((cat: any) => {
            const catName = normalizeLookupKey(cat.name ?? cat.nama)
            const total = availableItems.filter((item: any) => isCategoryMatch(item, cat)).length
            return [catName, total]
          })
        )
      } catch {
        // Jika fetch /items gagal, fallback ke totalItems dari API kategori
        // (hanya untuk admin — mitra tidak punya fallback yang bermakna)
        if (user.role !== "mitra") {
          stockPerCategory = new Map(
            rawCategories.map((cat: any) => [
              normalizeLookupKey(cat.name ?? cat.nama),
              Number(cat.totalItems ?? cat.total_items ?? cat.stok ?? 0),
            ])
          )
        }
      }

      const now = new Date().toISOString()
      const safetyAlerts: NotificationItem[] = rawCategories
        .filter((cat: any) => {
          const safety = Number(cat.safetyStock ?? cat.safety_stock ?? cat.minimumStock ?? 0)
          if (safety <= 0) return false

          const catName = normalizeLookupKey(cat.name ?? cat.nama)
          const total = stockPerCategory.get(catName) ?? 0

          return total < safety
        })
        .map((cat: any) => {
          const name   = String(cat.name ?? cat.nama ?? "Kategori")
          const safety = Number(cat.safetyStock ?? cat.safety_stock ?? cat.minimumStock ?? 0)
          const catName = normalizeLookupKey(name)
          const total   = stockPerCategory.get(catName) ?? 0

          const scope = user.role === "mitra"
            ? `(stok Anda: ${total} unit)`
            : `(stok tersedia: ${total} unit)`

          return {
            id: `local-ss-${user.id}-${cat.id ?? name}`,
            title: `⚠️ Stok Kritis: ${name}`,
            message: `${scope} di bawah batas minimum ${safety} unit. Segera lakukan pengadaan barang.`,
            type: "warning",
            date: now,
            isRead: false,
          } satisfies NotificationItem
        })

      setItems((prev) => {
        // Hapus notif safety stock lama milik akun ini, ganti dengan yang baru
        const prefix = `local-ss-${user.id}-`
        const withoutOldSS = prev.filter((n) => !n.id.startsWith(prefix))
        return safetyAlerts.length > 0
          ? [...safetyAlerts, ...withoutOldSS]
          : withoutOldSS
      })
    } catch (error) {
      console.error("Safety stock check failed:", error)
    }
  }, [user])

  React.useEffect(() => {
    // Run both checks immediately when app opens
    fetchNotifications()
    checkSafetyStock()
    // Poll server notifications every 10 seconds; re-check safety stock every 5 minutes
    const notifInterval = setInterval(fetchNotifications, 10000)
    const safetyInterval = setInterval(checkSafetyStock, 5 * 60 * 1000)
    return () => {
      clearInterval(notifInterval)
      clearInterval(safetyInterval)
    }
  }, [fetchNotifications, checkSafetyStock])

  const unreadCount = items.filter((n) => !n.isRead).length

  const markAllAsRead = async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/notifications/read-all`, {
        method: "PATCH",
        headers: getHeaders(),
      })
      if (res.ok) {
        fetchNotifications()
      }
    } catch (error) {
      console.error("Failed to mark all as read:", error)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      const res = await fetch(`${getBaseUrl()}/notifications/${id}/read`, {
        method: "PATCH",
        headers: getHeaders(),
      })
      if (res.ok) {
        fetchNotifications()
      }
    } catch (error) {
      console.error("Failed to mark as read:", error)
    }
  }

  const getIconProps = (type: string) => {
    switch (type) {
      case "warning":
        return { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" }
      case "success":
        return { icon: Check, color: "text-emerald-500", bg: "bg-emerald-500/10" }
      case "error":
        return { icon: XCircle, color: "text-red-600", bg: "bg-red-600/10" }
      case "info":
      default:
        return { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10" }
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative group rounded-full cursor-pointer">
          <Bell className="size-[1.15rem] text-muted-foreground transition-all group-hover:text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-background">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0 md:w-95" align="end" sideOffset={8}>
        <div className="flex items-center justify-between border-b px-4 py-3 gap-3">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm">Notifikasi</p>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {unreadCount} baru
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllAsRead}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Tandai semua sudah dibaca
          </Button>
        </div>
        <Tabs defaultValue="all">
          <TabsList className="border-b border-border w-full">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <ScrollArea className="h-100">
              <div className="flex flex-col gap-1 p-2">
                {items.length === 0 ? (
                  <div className="text-center p-4 text-sm text-muted-foreground">
                    Tidak ada notifikasi
                  </div>
                ) : (
                  items.map((notification) => {
                    const { icon: Icon, color, bg } = getIconProps(notification.type)
                    return (
                      <button
                        key={notification.id}
                        onClick={() => markAsRead(notification.id)}
                        className={cn(
                          "flex items-start gap-3 rounded-lg p-3 text-left transition-all hover:bg-accent focus:bg-accent outline-none",
                          !notification.isRead && "bg-muted/40"
                        )}
                      >
                        <div
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-full mt-0.5",
                            bg,
                            color
                          )}
                        >
                          <Icon className="size-4.5" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <p
                            className={cn(
                              "text-sm leading-tight text-foreground",
                              !notification.isRead ? "font-semibold" : "font-medium"
                            )}
                          >
                            {notification.title}
                          </p>
                          <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                            {notification.message}
                          </p>
                          <p className="text-[10px] font-medium text-muted-foreground/60 mt-1">
                            {formatTime(notification.date)}
                          </p>
                        </div>
                        {!notification.isRead && (
                          <div className="ml-auto mt-1 flex size-2 shrink-0 rounded-full bg-primary" />
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="unread">
            <ScrollArea className="h-100">
              <div className="flex flex-col gap-1 p-2">
                {items.filter((notification) => !notification.isRead).length === 0 ? (
                  <div className="text-center p-4 text-sm text-muted-foreground">
                    Tidak ada notifikasi baru
                  </div>
                ) : (
                  items
                    .filter((notification) => !notification.isRead)
                    .map((notification) => {
                      const { icon: Icon, color, bg } = getIconProps(notification.type)
                      return (
                        <button
                          key={notification.id}
                          onClick={() => markAsRead(notification.id)}
                          className={cn(
                            "flex items-start gap-3 rounded-lg p-3 text-left transition-all hover:bg-accent focus:bg-accent outline-none",
                            !notification.isRead && "bg-muted/40"
                          )}
                        >
                          <div
                            className={cn(
                              "flex size-9 shrink-0 items-center justify-center rounded-full mt-0.5",
                              bg,
                              color
                            )}
                          >
                            <Icon className="size-4.5" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <p
                              className={cn(
                                "text-sm leading-tight text-foreground",
                                !notification.isRead ? "font-semibold" : "font-medium"
                              )}
                            >
                              {notification.title}
                            </p>
                            <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                              {notification.message}
                            </p>
                            <p className="text-[10px] font-medium text-muted-foreground/60 mt-1">
                              {formatTime(notification.date)}
                            </p>
                          </div>
                          {!notification.isRead && (
                            <div className="ml-auto mt-1 flex size-2 shrink-0 rounded-full bg-primary" />
                          )}
                        </button>
                      )
                    })
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}
