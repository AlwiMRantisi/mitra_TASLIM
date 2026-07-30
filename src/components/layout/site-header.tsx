import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { useLocation, useNavigate } from "react-router-dom"
import { Notifications } from "@/features/dashboard/components/notifications"
import { Sun, Moon, LogOut, Bell, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/shared/themeProvider"
import { useAuth } from "@/lib/auth"
import React, { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

export function SiteHeader({ className }: { className?: string }) {
    const location = useLocation()
    const path = location.pathname
    const { theme, setTheme } = useTheme()
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)

    const handleLogout = () => {
        logout()
        setIsLogoutDialogOpen(false)
        navigate("/login", { replace: true })
    }

    // Determine breadcrumbs based on route
    let parent = "Menu Utama"
    let pageName = "Dashboard"
    let parentLink = "#"
    let grandparent = ""

    if (path === "/barang-masuk") {
        parent = "Operasional"
        pageName = "Barang Masuk"
    } else if (path === "/barang-keluar") {
        parent = "Operasional"
        pageName = "Barang Keluar"
    } else if (path === "/request") {
        parent = "Operasional"
        pageName = "Request"
    } else if (path.startsWith("/request/")) {
        grandparent = "Operasional"
        parent = "Request"
        pageName = "Detail Permintaan"
        parentLink = "#/request"
    } else if (path === "/partner-request/new") {
        parent = "Operasional"
        pageName = "Ajukan Request"
    } else if (path === "/partner-request/history") {
        parent = "Operasional"
        pageName = "Histori Request"
    } else if (path === "/data-barang") {
        parent = "Inventori"
        pageName = "Data Barang"
    } else if (path === "/data-transaksi") {
        parent = "Inventori"
        pageName = "Data Transaksi"
    } else if (path === "/lokasi-barang") {
        parent = "Manajemen Data"
        pageName = "Lokasi Barang"
    } else if (path === "/tipe-material") {
        parent = "Manajemen Data"
        pageName = "Model Material"
    } else if (path === "/kategori-barang") {
        parent = "Manajemen Data"
        pageName = "Kategori Barang"
    } else if (path === "/merek-barang") {
        parent = "Manajemen Data"
        pageName = "Merek Barang"
    } else if (path === "/mitra") {
        parent = "Manajemen Data"
        pageName = "Mitra"
    }

    return (
        <header className={`flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) ${className || ''}`}>
            <div className="flex w-full items-center justify-between gap-1 px-4 lg:gap-2 lg:px-6">
                <div className="flex items-center gap-1">
                    <SidebarTrigger className="-ml-1" />
                    <Separator
                        orientation="vertical"
                        className="mx-2 data-[orientation=vertical]:h-4"
                    />
                    <Breadcrumb className="flex-1">
                        <BreadcrumbList>
                            {grandparent && (
                                <>
                                    <BreadcrumbItem className="hidden md:block">
                                        <BreadcrumbLink href="#">
                                            {grandparent}
                                        </BreadcrumbLink>
                                    </BreadcrumbItem>
                                    <BreadcrumbSeparator className="hidden md:block" />
                                </>
                            )}
                            <BreadcrumbItem className="hidden md:block">
                                <BreadcrumbLink href={parentLink}>
                                    {parent}
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem>
                                <BreadcrumbPage>{pageName}</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>
                <div className="hidden md:flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                        title="Toggle theme"
                    >
                        <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                        <span className="sr-only">Toggle theme</span>
                    </Button>
                    <Notifications />
                    
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src="" alt={user?.displayName || "User"} />
                                    <AvatarFallback>{(user?.displayName || "U").slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align="end" forceMount>
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">{user?.displayName || "User"}</p>
                                    <p className="text-xs leading-none text-muted-foreground">
                                        {user?.username || ""}
                                    </p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                                <DropdownMenuItem>
                                    <User className="mr-2 h-4 w-4" />
                                    <span>Profil</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                    <Bell className="mr-2 h-4 w-4" />
                                    <span>Notifikasi</span>
                                </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-400 focus:text-red-400 focus:bg-red-400/10 cursor-pointer" onClick={() => setIsLogoutDialogOpen(true)}>
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Keluar</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <AlertDialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
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
                            <LogOut className="mr-2 h-4 w-4" />
                            Ya, Keluar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </header>
    )
}
