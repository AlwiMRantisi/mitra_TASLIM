import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from "@/components/ui/sidebar"
import { useLocation, Link } from "react-router-dom"
import React from "react"

export function NavMain({
  items,
}: {
  items: {
    title: string
    items: {
      title: string
      url: string
      icon: React.ReactNode
      isActive: boolean
    }[]
  }[]
}) {
  const location = useLocation()

  return (
    <SidebarGroup>
      {items.map((item) => (
        <div className="mb-4" key={item.title}>
          <SidebarGroupLabel>{item.title}</SidebarGroupLabel>

          <SidebarMenu>
            {item.items.map((subItem) => {
              const active = location.pathname === subItem.url
              return (
                <SidebarMenuItem key={subItem.title}>
                  <SidebarMenuButton asChild isActive={active} tooltip={subItem.title}>
                    <Link to={subItem.url}>
                      {subItem.icon}
                      <span>{subItem.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </div>
      ))}
    </SidebarGroup>
  )
}
