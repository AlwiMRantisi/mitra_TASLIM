import { AppSidebar } from "@/components/layout/navigation/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
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
            className="h-svh overflow-hidden print:h-auto print:overflow-visible print:block print:w-full"
        >
            <AppSidebar className="print:hidden" />
            <SidebarInset className="h-svh overflow-hidden flex flex-col print:!ml-0 print:h-auto print:overflow-visible print:block print:w-full print:!min-h-0">
                <SiteHeader className="print:hidden" />
                <div className="flex-1 overflow-y-auto overscroll-none print:overflow-visible print:block print:h-auto print:w-full">
                    <Outlet />
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
