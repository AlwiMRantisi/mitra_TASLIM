import { ActivityIcon, ArrowUpRight } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { ActivityItem } from "@/types/transaction"
import { useNavigate } from "react-router-dom"

interface ActivityFeedCardProps {
  activities: ActivityItem[]
  isLoading: boolean
  className?: string
}

function formatRelativeTime(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60_000)
    const hours = Math.floor(diff / 3_600_000)
    const days = Math.floor(diff / 86_400_000)

    if (minutes < 1) return "Baru saja"
    if (minutes < 60) return `${minutes}m lalu`
    if (hours < 24) return `${hours}j lalu`
    return `${days}h lalu`
  } catch {
    return "-"
  }
}

function getActionDescription(type: string, sn: string): string {
  switch (type.toUpperCase()) {
    case "MASUK":
      return `melakukan inbound aset ${sn}`
    case "KELUAR":
      return `melakukan outbound aset ${sn}`
    case "RUSAK":
      return `melaporkan aset rusak ${sn}`
    case "HILANG":
      return `melaporkan aset hilang ${sn}`
    default:
      return `melakukan aktivitas pada aset ${sn}`
  }
}

export function ActivityFeedCard({ activities, isLoading, className }: ActivityFeedCardProps) {
  const navigate = useNavigate()
  const [showTopGradient, setShowTopGradient] = useState(false)
  const [showBottomGradient, setShowBottomGradient] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    setShowTopGradient(scrollTop > 0)
    // Add small buffer to prevent sub-pixel issues on high DPI displays
    setShowBottomGradient(scrollTop + clientHeight < scrollHeight - 1.5)
  }

  useEffect(() => {
    // Beri jeda sedikit agar DOM selesai menggambar list item baru sebelum menghitung tinggi
    const timer = setTimeout(() => checkScroll(), 50)
    window.addEventListener('resize', checkScroll)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', checkScroll)
    }
  }, [activities])

  return (
    <Card className={cn("flex flex-col h-full shadow-sm", className)}>
      <CardHeader className="flex flex-row justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">Aktivitas Terkini</CardTitle>
          <CardDescription>Menampilkan aktivitas terakhir dalam sistem</CardDescription>
        </div>
        <div
          onClick={() => navigate("/")}
          className="rounded-full p-1.5 cursor-pointer bg-muted transition-colors hover:bg-muted/80"
        >
          <ArrowUpRight size={14} className="text-muted-foreground" />
        </div>
      </CardHeader>
      <div className="relative flex-1 min-h-0 max-h-[368px]">
        {/* Top Gradient Overlay */}
        <div
          className={cn(
            "absolute -top-px left-0 right-0 h-12 bg-linear-to-b from-card to-transparent pointer-events-none z-10 transition-opacity duration-300",
            showTopGradient ? "opacity-100" : "opacity-0"
          )}
        />

        <div
          data-slot="card-content"
          ref={scrollRef}
          onScroll={checkScroll}
          className="p-0 h-full overflow-y-auto"
        >
          {isLoading ? (
            <div className="flex flex-col gap-0 px-4 py-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-start gap-3 py-2">
                  <div className="flex flex-col items-center">
                    <div className="size-2 rounded-full bg-muted mt-1.5 shrink-0" />
                    {i < 5 && <div className="w-px h-6 bg-border mt-1" />}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1 pt-0.5">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-2 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center px-4">
              <div className="size-10 rounded-full bg-muted flex items-center justify-center">
                <ActivityIcon className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Belum ada aktivitas</p>
            </div>
          ) : (
            <div className="flex flex-col px-4">
              {activities.map((activity) => {
                return (
                  <div key={activity.id} className="flex items-center gap-4 pb-4">
                    <div className="size-8 rounded-full bg-muted-foreground" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-foreground leading-tight truncate">
                            {activity.mitra}
                          </span>
                          <span className="text-xs text-muted-foreground mt-2">
                            {getActionDescription(activity.type, activity.serialNumber)}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 pt-0.5">
                          {formatRelativeTime(activity.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Bottom Gradient Overlay */}
        <div
          className={cn(
            "absolute -bottom-px left-0 right-0 h-12 bg-linear-to-t from-card to-transparent pointer-events-none z-10 transition-opacity duration-300",
            showBottomGradient ? "opacity-100" : "opacity-0"
          )}
        />
      </div>
    </Card>
  )
}
