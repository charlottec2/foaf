import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { UnlockBanner } from "./UnlockBanner";

export const MobileShell = ({ children, hideNav }: { children: ReactNode; hideNav?: boolean }) => {
  return (
    <div className="min-h-screen bg-background">
      <UnlockBanner />
      <main className={hideNav ? "pb-4" : "pb-24"}>{children}</main>
      {!hideNav && <BottomNav />}
    </div>
  );
};
