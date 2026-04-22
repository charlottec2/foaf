import { Link, useLocation } from "react-router-dom";
import { House, CalendarPlus, Plus, Sparkle, User } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/",         label: "Home",    icon: House },
  { to: "/gather",   label: "Gather",  icon: CalendarPlus },
  { to: "/gather/new", label: "New",   icon: Plus },
  { to: "/circle",   label: "Circle",  icon: Sparkle },
  { to: "/me",       label: "Profile", icon: User },
];

export const BottomNav = () => {
  const { pathname } = useLocation();
  return (
    <nav className="fixed inset-x-0 bottom-8 z-40 flex justify-center px-6 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-6 rounded-full bg-tabbar px-8 py-3.5 shadow-lg">
        {items.map((it) => {
          const active = pathname === it.to || (it.to !== "/" && it.to !== "/gather/new" && pathname.startsWith(it.to));
          const Icon = it.icon;
          const isNew = it.to === "/gather/new";
          return (
            <Link
              key={it.to}
              to={it.to}
              aria-label={it.label}
              className={cn(
                "flex items-center justify-center transition-colors",
                isNew
                  ? "rounded-full bg-brand p-2"
                  : active
                  ? "text-brand"
                  : "text-white/60 hover:text-white"
              )}
            >
              <Icon size={22} weight={active || isNew ? "fill" : "regular"} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
