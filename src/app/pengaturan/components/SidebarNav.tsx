import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface SidebarNavItem {
  title: string
  id: string
  adminOnly?: boolean
}

interface SidebarNavGroup {
  groupLabel?: string
  items: SidebarNavItem[]
}

interface SidebarNavProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onSelect'> {
  groups: SidebarNavGroup[]
  activeId: string
  onSelect: (id: string) => void
  isAdmin: boolean
}

export function SidebarNav({ className, groups, activeId, onSelect, isAdmin, ...props }: SidebarNavProps) {
  return (
    <nav
      className={cn(
        "flex flex-col",
        className
      )}
      {...props}
    >
      {groups.map((group, groupIdx) => {
        const visibleItems = group.items.filter(item => !item.adminOnly || isAdmin);

        if (visibleItems.length === 0) return null;

        return (
          <div key={groupIdx} className="flex flex-col space-y-2 px-3 pt-5 pb-3 border-b">
            {group.groupLabel && (
              <h4 className="px-3 text-xs font-medium flex-col space-y-6 text-muted-foreground/70 uppercase">
                {group.groupLabel}
              </h4>
            )}
            <div className="flex flex-wrap lg:flex-col">
              {visibleItems.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  className={cn(
                    "justify-start px-1 h-7 rounded-md active:translate-y-0! cursor-pointer",
                    activeId === item.id
                      ? "bg-muted/50 text-foreground hover:bg-muted/50"
                      : "hover:bg-muted/30! hover:text-foreground text-muted-foreground"
                  )}
                  onClick={() => onSelect(item.id)}
                >
                  <span className="ml-2 text-xs font-medium">{item.title}</span>
                </Button>

              ))}
            </div>
          </div>
        )
      })}
    </nav>
  )
}
