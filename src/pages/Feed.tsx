import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { InitiativeCard, FeedInitiative } from "@/components/InitiativeCard";
import { shortestPath } from "@/lib/graph";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";

const Feed = () => {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<FeedInitiative[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      // RLS handles visibility gating — we just SELECT.
      const { data: inits } = await supabase
        .from("initiatives")
        .select("id, title, description, category, starts_at, location, size_cap, host_id")
        .order("starts_at", { ascending: true });

      if (!inits) {
        setItems([]);
        setLoading(false);
        return;
      }

      const hostIds = Array.from(new Set(inits.map((i: any) => i.host_id)));
      const { data: hosts } = await supabase
        .from("profiles")
        .select("id, handle, display_name")
        .in("id", hostIds);
      const hostMap = new Map((hosts ?? []).map((h: any) => [h.id, h]));

      // Member counts (approved only)
      const { data: members } = await supabase
        .from("initiative_members")
        .select("initiative_id, status")
        .in("initiative_id", inits.map((i: any) => i.id));
      const counts = new Map<string, number>();
      (members ?? []).forEach((m: any) => {
        if (m.status === "approved")
          counts.set(m.initiative_id, (counts.get(m.initiative_id) ?? 0) + 1);
      });

      // Resolve shortest path for each
      const enriched: FeedInitiative[] = await Promise.all(
        inits.map(async (i: any) => {
          let pathIds: string[] | null = [user.id, i.host_id];
          if (i.host_id !== user.id) {
            pathIds = await shortestPath(user.id, i.host_id, 4);
            if (!pathIds) pathIds = [user.id, i.host_id];
          }
          const { data: pathProfiles } = await supabase
            .from("profiles")
            .select("id, handle, display_name")
            .in("id", pathIds);
          const pmap = new Map((pathProfiles ?? []).map((p: any) => [p.id, p]));
          const pathNodes = pathIds.map(
            (id) => pmap.get(id) ?? { id, handle: "?", display_name: "someone" }
          );
          const host = hostMap.get(i.host_id) ?? { id: i.host_id, handle: "?", display_name: "Host" };
          return {
            id: i.id,
            title: i.title,
            description: i.description,
            category: i.category,
            starts_at: i.starts_at,
            location: i.location,
            size_cap: i.size_cap,
            host: host as any,
            pathNodes: pathNodes as any,
            attendeeCount: counts.get(i.id) ?? 0,
          };
        })
      );

      setItems(enriched);
      setLoading(false);
    })();
  }, [user]);

  return (
    <MobileShell>
      <header className="container-mobile sticky top-0 z-30 -mx-4 mb-2 bg-background/90 px-4 pt-6 pb-3 backdrop-blur">
        <div className="flex items-end justify-between">
          <div>
            <p className="label-mono text-muted-foreground">YOUR FEED</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              {profile ? `Hi, ${profile.display_name.split(" ")[0]}` : "Initiatives"}
            </h1>
          </div>
          <Link
            to="/new"
            className="inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-2 text-xs font-medium text-background"
          >
            <Plus className="h-4 w-4" /> New
          </Link>
        </div>
      </header>

      <section className="container-mobile flex flex-col gap-3">
        {loading && <p className="font-mono text-xs text-muted-foreground">Loading…</p>}
        {!loading && items.length === 0 && (
          <div className="mt-10 rounded-2xl border border-dashed border-hairline p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Quiet for now. Connect with more friends to unlock more of the world — or post the first initiative.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link to="/connections" className="rounded-full bg-foreground py-2.5 text-sm font-medium text-background">
                Grow your network
              </Link>
              <Link to="/new" className="rounded-full border border-hairline py-2.5 text-sm font-medium">
                Create an initiative
              </Link>
            </div>
          </div>
        )}
        {items.map((it) => (
          <InitiativeCard key={it.id} it={it} />
        ))}
      </section>
    </MobileShell>
  );
};

export default Feed;
