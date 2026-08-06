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

type NotificationItem = {
  id: string
  title: string
  message: string
  type: string
  date: string
  isRead: boolean
}

const getBaseUrl = () => {
  const baseUrl = import.meta.env.URL || import.meta.env.VITE_URL || "http://172.168.9.139:3000/"
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

export function Notifications() {
  const [open, setOpen] = React.useState(false)
  const [items, setItems] = React.useState<NotificationItem[]>([])
  
  const fetchNotifications = React.useCallback(async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/notifications`, {
        method: "GET",
        headers: getHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.data)) {
          const mapped = data.data.map((n: any) => ({
            ...n,
            date: n.createdAt || n.date
          }))
          setItems(mapped)
        }
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error)
    }
  }, [])

  React.useEffect(() => {
    fetchNotifications()
    // Optional: setup a polling interval if you want real-time updates
    const interval = setInterval(fetchNotifications, 10000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

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
