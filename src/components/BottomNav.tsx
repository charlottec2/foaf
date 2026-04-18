import { Link, useLocation } from "react-router-dom";
import { Compass, Users, Plus, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Feed", icon: Compass },
  { to: "/connections", label: "People", icon: Users },
  { to: "/new", label: "Create", icon: Plus, primary: true },
  { to: "/me", label: "You", icon: User },
];

export const BottomNav = () => {
  const { pathname } = useLocation();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container-mobile flex items-center justify-between py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {items.map((it) => {
          const active = pathname === it.to;
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-[10px] uppercase tracking-[0.14em] font-mono",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full",
                  it.primary ? "bg-primary text-primary-foreground" : ""
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={2.25} />
              </span>
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
