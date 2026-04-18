import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { MobileShell } from "@/components/MobileShell";
import { GatherCard } from "@/components/GatherCard";
import { loadEnrichedGathers, EnrichedGather } from "@/lib/gathers";
import { CalendarPlus } from "lucide-react";

const Gather = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<EnrichedGather[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const g = await loadEnrichedGathers(user.id, { upcomingOnly: true, excludeMine: true });
      setItems(g);
      setLoading(false);
    })();
  }, [user]);

  return (
    <MobileShell>
      <header className="container-mobile sticky top-0 z-30 -mx-4 mb-3 bg-background/95 px-4 pt-6 pb-3 backdrop-blur">
        <div className="flex items-end justify-between">
          <div>
            <p className="label-mono text-muted-foreground">GATHER</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Open in your network</h1>
          </div>
          <Link
            to="/gather/new"
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
          >
            <CalendarPlus className="h-4 w-4" /> Host
          </Link>
        </div>
      </header>

      <section className="container-mobile flex flex-col gap-3">
        {loading && <p className="font-mono text-xs text-muted-foreground">Loading…</p>}
        {!loading && items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-hairline p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Nothing open right now. Be the first — or connect with more people in Circle to unlock more.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link to="/gather/new" className="rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground">
                Host a Gather
              </Link>
              <Link to="/circle" className="rounded-full border border-hairline py-2.5 text-sm font-medium">
                Open Circle
              </Link>
            </div>
          </div>
        )}
        {items.map((it) => (
          <GatherCard key={it.id} it={it} />
        ))}
      </section>
    </MobileShell>
  );
};

export default Gather;
