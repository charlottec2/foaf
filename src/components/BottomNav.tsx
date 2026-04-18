import { Link, useLocation } from "react-router-dom";
import { Home, CalendarPlus, Users, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/gather", label: "Gather", icon: CalendarPlus },
  { to: "/groups", label: "Groups", icon: Users },
  { to: "/circle", label: "Circle", icon: Sparkles },
  { to: "/me", label: "Profile", icon: User },
];

export const BottomNav = () => {
  const { pathname } = useLocation();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="container-mobile flex items-stretch justify-between py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {items.map((it) => {
          const active = pathname === it.to || (it.to !== "/" && pathname.startsWith(it.to));
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[9px] uppercase tracking-[0.14em] font-mono transition",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
