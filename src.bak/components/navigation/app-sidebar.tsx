"use client"

import * as React from "react"

import { NavMain } from "@/components/navigation/nav-main"
import { NavProjects } from "@/components/navigation/nav-projects"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  CircleStar,
  Database,
  Handshake,
  HistoryIcon,
  LayoutGrid,
  LogOut,
  MapPinHouse,
  PackageMinus,
  PackagePlus,
  Settings,
  Shapes,
  Zap,
} from "lucide-react"
import { useAuth } from "@/lib/auth"
import { useNavigate } from "react-router-dom"
import { NavUser } from "./nav-user"

const data = {
  navMain: [
    {
      title: "Operasional",
      items: [
        {
          title: "Barang Masuk",
          url: "/barang-masuk",
          icon: (
            <PackagePlus />
          ),
          isActive: false,
        },
        {
          title: "Barang Keluar",
          url: "/barang-keluar",
          icon: (
            <PackageMinus />
          ),
          isActive: false,
        },
        {
          title: "Riwayat",
          url: "/riwayat",
          icon: (
            <HistoryIcon />
          ),
          isActive: false,
        },
      ],
    },
    {
      title: "Inventori",
      items: [
        {
          title: "Data Barang",
          url: "/data-barang",
          icon: (
            <Database />
          ),
          isActive: false,
        }
      ],
    },
    {
      title: "Manajemen Data",
      items: [
        {
          title: "Lokasi Barang",
          url: "/lokasi-barang",
          icon: (
            <MapPinHouse />
          ),
          isActive: false,
        },
        {
          title: "Kategori Barang",
          url: "/kategori-barang",
          icon: (
            <Shapes />
          ),
          isActive: false,
        },
        {
          title: "Merek Barang",
          url: "/merek-barang",
          icon: (
            <CircleStar />
          ),
          isActive: false,
        },
        {
          title: "Mitra",
          url: "/mitra",
          icon: (
            <Handshake />
          ),
          isActive: false,
        }
      ],
    },
  ],
  main: [
    {
      name: "Dashboard",
      url: "/",
      icon: (
        <LayoutGrid
        />
      ),
      isActive: true,
    },
    {
      name: "Pengaturan",
      url: "/pengaturan",
      icon: (
        <Settings
        />
      ),
      isActive: true,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = React.useState(false)
  const isAdmin = user?.role === "admin"
  const mitraAllowedUrls = new Set([
    "/barang-masuk",
    "/barang-keluar",
    "/riwayat",
    "/data-barang",
  ])
  const visibleNavMain = isAdmin
    ? data.navMain
    : data.navMain
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => mitraAllowedUrls.has(item.url)),
      }))
      .filter((group) => group.items.length > 0)

  const handleLogout = () => {
    logout()
    setIsLogoutDialogOpen(false)
    navigate("/login", { replace: true })
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Arxiva Inventory"
              className="pointer-events-none"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-blue-600 text-yellow-300">
                <Zap className="size-4" fill="currentColor" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">PT ICON Plus Tasikmalaya</span>
                <span className="truncate text-xs">Inventory Management</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavProjects main={data.main} />
        <NavMain items={visibleNavMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: user?.displayName || user?.username || "User",
            email: user?.username || "",
            avatar: "",
          }}
          onLogout={() => setIsLogoutDialogOpen(true)}
        />
      </SidebarFooter>
      <SidebarRail />
      <AlertDialog
        open={isLogoutDialogOpen}
        onOpenChange={setIsLogoutDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi logout</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin keluar dari akun {user?.displayName}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>
              <LogOut className="size-4" />
              Ya, Keluar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  )
}
