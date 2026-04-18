import { useEffect, useState } from "react";
import { onNetworkExpansion } from "@/lib/events";
import { Sparkles, X } from "lucide-react";

export const UnlockBanner = () => {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const off = onNetworkExpansion(({ name }) => {
      setMsg(`Your network just grew — you're now connected with ${name}`);
      const t = setTimeout(() => setMsg(null), 6000);
      return () => clearTimeout(t);
    });
    return off;
  }, []);

  if (!msg) return null;
  return (
    <div className="sticky top-0 z-50 animate-banner-in border-b border-hairline bg-accent text-accent-foreground">
      <div className="container-mobile flex items-center gap-3 py-2.5">
        <Sparkles className="h-4 w-4 shrink-0" />
        <p className="flex-1 text-[13px] font-medium leading-snug">{msg}</p>
        <button onClick={() => setMsg(null)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
