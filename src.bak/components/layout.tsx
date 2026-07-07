import { AppSidebar } from "@/components/navigation/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
    SidebarInset,
    SidebarProvider,
} from "@/components/ui/sidebar"
import React from "react"
import { Outlet } from "react-router-dom"

export default function Layout() {
    return (
        <SidebarProvider
            defaultOpen={false}
            style={
                {
                    "--sidebar-width": "calc(var(--spacing) * 72)",
                    "--header-height": "calc(var(--spacing) * 12)",
                } as React.CSSProperties
            }
            className="h-svh overflow-hidden"
        >
            <AppSidebar />
            <SidebarInset className="h-svh overflow-hidden flex flex-col">
                <SiteHeader />
                <div className="flex-1 overflow-y-auto overscroll-none">
                    <Outlet />
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
