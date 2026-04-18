import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { Sparkles } from "lucide-react";
import { getDirectConnections } from "@/lib/graph";

type Suggestion = {
  id: string;
  handle: string;
  display_name: string;
  mutualCount: number;
  // Up to 3 example mutual pairings: "College Friend of Alex"
  viaLabels: { viaName: string; label: string }[];
};

const Circle = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      // 1. My direct connections
      const myConns = await getDirectConnections(user.id);
      if (myConns.length === 0) { setItems([]); setLoading(false); return; }

      // 2. Profiles of my connections (for viaName)
      const { data: myConnProfiles } = await supabase
        .from("profiles")
        .select("id, display_name, handle")
        .in("id", myConns);
      const myConnNameMap = new Map((myConnProfiles ?? []).map((p: any) => [p.id, p.display_name]));

      // 3. My labels for each connection (how they described me / how I described them — we use their label of me as the trust signal)
      const { data: myConnEdges } = await supabase
        .from("connections")
        .select("requester_id, addressee_id, requester_label, addressee_label")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq("status", "accepted");
      const myLabelOfMutual = new Map<string, string>(); // viaUserId -> their label of me
      (myConnEdges ?? []).forEach((c: any) => {
        const otherId = c.requester_id === user.id ? c.addressee_id : c.requester_id;
        const theirLabelOfMe = c.requester_id === user.id ? c.addressee_label : c.requester_label;
        if (theirLabelOfMe) myLabelOfMutual.set(otherId, theirLabelOfMe);
      });

      // 4. Edges out of each of my connections to find friends-of-friends
      const { data: foF } = await supabase
        .from("connections")
        .select("requester_id, addressee_id, requester_label, addressee_label")
        .or(myConns.map((id) => `requester_id.eq.${id},addressee_id.eq.${id}`).join(","))
        .eq("status", "accepted");

      // candidate -> { count, via: [{viaId, viaName, label}] }
      const candidates = new Map<string, { count: number; via: { viaName: string; label: string }[]; viaIdSet: Set<string> }>();
      const meAndConnsSet = new Set([user.id, ...myConns]);

      (foF ?? []).forEach((c: any) => {
        const [a, b] = [c.requester_id, c.addressee_id];
        const labels = { [a]: c.addressee_label, [b]: c.requester_label } as Record<string, string | null>;
        for (const [viaId, candId] of [
          [a, b],
          [b, a],
        ]) {
          if (!myConns.includes(viaId)) continue;
          if (meAndConnsSet.has(candId)) continue; // skip me & my direct conns
          const labelOfCand = labels[viaId]; // viaId's label of candId
          let entry = candidates.get(candId);
          if (!entry) {
            entry = { count: 0, via: [], viaIdSet: new Set() };
            candidates.set(candId, entry);
          }
          if (entry.viaIdSet.has(viaId)) continue;
          entry.viaIdSet.add(viaId);
          entry.count += 1;
          if (entry.via.length < 3) {
            entry.via.push({
              viaName: myConnNameMap.get(viaId) ?? "a friend",
              label: labelOfCand || "Friend",
            });
          }
        }
      });

      // 5. Filter out already-pending connections in either direction
      const { data: pendingEdges } = await supabase
        .from("connections")
        .select("requester_id, addressee_id, status")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
      const blocked = new Set<string>();
      (pendingEdges ?? []).forEach((c: any) => {
        blocked.add(c.requester_id === user.id ? c.addressee_id : c.requester_id);
      });

      const candidateIds = Array.from(candidates.keys()).filter((id) => !blocked.has(id));
      if (candidateIds.length === 0) { setItems([]); setLoading(false); return; }

      const { data: candProfiles } = await supabase
        .from("profiles")
        .select("id, handle, display_name")
        .in("id", candidateIds);

      const out: Suggestion[] = (candProfiles ?? [])
        .map((p: any) => {
          const c = candidates.get(p.id)!;
          return { id: p.id, handle: p.handle, display_name: p.display_name, mutualCount: c.count, viaLabels: c.via };
        })
        .sort((a, b) => b.mutualCount - a.mutualCount);

      setItems(out);
      setLoading(false);
    })();
  }, [user]);

  return (
    <MobileShell>
      <header className="container-mobile sticky top-0 z-30 -mx-4 mb-3 bg-background/95 px-4 pt-6 pb-3 backdrop-blur">
        <p className="label-mono text-muted-foreground">CIRCLE</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">People you could know</h1>
        <p className="mt-1 text-xs text-muted-foreground">Friends-of-friends, ranked by closeness. No algorithm.</p>
      </header>

      <section className="container-mobile flex flex-col gap-2">
        {loading && <p className="font-mono text-xs text-muted-foreground">Loading…</p>}
        {!loading && items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-hairline p-6 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No friends-of-friends yet. Invite a couple of friends from Profile, and your Circle will fill in.
            </p>
            <Link to="/me" className="mt-4 inline-block rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              Invite a friend
            </Link>
          </div>
        )}
        {items.map((p) => (
          <Link
            key={p.id}
            to={`/u/${p.handle}`}
            className="block rounded-2xl border border-hairline bg-surface px-4 py-3 transition hover:border-foreground/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-base font-bold">
                  {p.display_name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">{p.display_name}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">@{p.handle}</p>
                </div>
              </div>
              <div className="shrink-0 rounded-full bg-primary px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-primary-foreground">
                {p.mutualCount} mutual
              </div>
            </div>
            {p.viaLabels.length > 0 && (
              <p className="mt-2 line-clamp-2 font-mono text-[11px] text-muted-foreground">
                {p.viaLabels.map((v, i) => (
                  <span key={i}>
                    "{v.label}" of <span className="text-foreground">{v.viaName}</span>
                    {i < p.viaLabels.length - 1 ? " · " : ""}
                  </span>
                ))}
              </p>
            )}
          </Link>
        ))}
      </section>
    </MobileShell>
  );
};

export default Circle;
