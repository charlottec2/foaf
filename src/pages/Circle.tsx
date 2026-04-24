import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { Sparkle, ArrowRight } from "@phosphor-icons/react";
import { getDirectConnections } from "@/lib/graph";

type Suggestion = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  mutualCount: number;
  viaLabels: { viaName: string; label: string }[];
};

const Avatar = ({
  name,
  src,
  size = 44,
  ring = false,
}: {
  name: string;
  src?: string | null;
  size?: number;
  ring?: boolean;
}) => (
  <div
    className="rounded-full bg-clay-soft flex items-center justify-center font-serif text-foreground shrink-0 overflow-hidden"
    style={{
      width: size,
      height: size,
      fontSize: size * 0.38,
      boxShadow: ring
        ? "0 0 0 1.5px hsl(var(--accent)), 0 0 0 4px hsl(var(--background))"
        : "0 0 0 2px hsl(var(--background))",
    }}
  >
    {src ? (
      <img src={src} alt={name} className="w-full h-full object-cover" />
    ) : (
      name[0]?.toUpperCase()
    )}
  </div>
);

const Circle = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);

      const myConns = await getDirectConnections(user.id);
      if (myConns.length === 0) { setItems([]); setLoading(false); return; }

      const { data: myConnProfiles } = await supabase
        .from("profiles").select("id, display_name, handle")
        .in("id", myConns);
      const myConnNameMap = new Map((myConnProfiles ?? []).map((p: any) => [p.id, p.display_name]));

      const { data: foF } = await supabase
        .from("connections")
        .select("requester_id, addressee_id, requester_label, addressee_label")
        .or(myConns.map((id) => `requester_id.eq.${id},addressee_id.eq.${id}`).join(","))
        .eq("status", "accepted");

      const candidates = new Map<string, { count: number; via: { viaName: string; label: string }[]; viaIdSet: Set<string> }>();
      const meAndConnsSet = new Set([user.id, ...myConns]);

      (foF ?? []).forEach((c: any) => {
        const [a, b] = [c.requester_id, c.addressee_id];
        const labels = { [a]: c.addressee_label, [b]: c.requester_label } as Record<string, string | null>;
        for (const [viaId, candId] of [[a, b], [b, a]]) {
          if (!myConns.includes(viaId)) continue;
          if (meAndConnsSet.has(candId)) continue;
          const labelOfCand = labels[viaId];
          let entry = candidates.get(candId);
          if (!entry) { entry = { count: 0, via: [], viaIdSet: new Set() }; candidates.set(candId, entry); }
          if (entry.viaIdSet.has(viaId)) continue;
          entry.viaIdSet.add(viaId);
          entry.count += 1;
          if (entry.via.length < 3) entry.via.push({ viaName: myConnNameMap.get(viaId) ?? "a friend", label: labelOfCand || "Friend" });
        }
      });

      const { data: pendingEdges } = await supabase
        .from("connections").select("requester_id, addressee_id, status")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
      const blocked = new Set<string>();
      (pendingEdges ?? []).forEach((c: any) => blocked.add(c.requester_id === user.id ? c.addressee_id : c.requester_id));

      const candidateIds = Array.from(candidates.keys()).filter((id) => !blocked.has(id));
      if (candidateIds.length === 0) { setItems([]); setLoading(false); return; }

      const { data: candProfiles } = await supabase
        .from("profiles").select("id, handle, display_name, avatar_url")
        .in("id", candidateIds);

      const out: Suggestion[] = (candProfiles ?? [])
        .map((p: any) => {
          const c = candidates.get(p.id)!;
          return { id: p.id, handle: p.handle, display_name: p.display_name, avatar_url: p.avatar_url ?? null, mutualCount: c.count, viaLabels: c.via };
        })
        .sort((a, b) => b.mutualCount - a.mutualCount);

      setItems(out);
      setLoading(false);
    })();
  }, [user]);

  return (
    <MobileShell>
      {/* Header */}
      <header className="container-mobile sticky top-0 z-30 mb-4 bg-background/95 pt-6 pb-3 backdrop-blur">
        <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-muted-foreground">Circle</p>
        <h1 className="mt-1 font-serif text-[26px] font-medium leading-tight">
          People you<br />could know
        </h1>
        <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
          Friends-of-friends · no algorithm
        </p>
      </header>

      <div className="container-mobile flex flex-col gap-3">
        {loading && (
          <p className="font-mono text-[11px] text-muted-foreground py-4">Loading…</p>
        )}

        {/* Hero card — shown when suggestions exist */}
        {!loading && items.length > 0 && (
          <div
            className="rounded-[24px] p-5 mb-1 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, hsl(var(--butter)) 0%, hsl(var(--accent-soft)) 60%, hsl(var(--clay-soft)) 100%)" }}
          >
            {/* Decorative circles */}
            <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-20" style={{ background: "hsl(var(--accent))" }} />
            <div className="absolute -bottom-4 right-8 w-16 h-16 rounded-full opacity-10" style={{ background: "hsl(var(--foreground))" }} />

            {/* Overlapping avatars */}
            <div className="flex -space-x-3 mb-4">
              {items.slice(0, 5).map((p) => (
                <Avatar key={p.id} name={p.display_name} src={p.avatar_url} size={48} />
              ))}
              {items.length > 5 && (
                <div
                  className="w-12 h-12 rounded-full bg-foreground flex items-center justify-center font-mono text-[11px] text-background"
                  style={{ boxShadow: "0 0 0 2px hsl(var(--background))" }}
                >
                  +{items.length - 5}
                </div>
              )}
            </div>

            <p className="font-serif text-[22px] font-medium leading-tight">
              {items.length} {items.length === 1 ? "person" : "people"} in<br />your extended circle
            </p>
            <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
              All connected through someone you trust
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && items.length === 0 && (
          <div
            className="rounded-[24px] p-8 text-center relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, hsl(var(--butter)) 0%, hsl(var(--accent-soft)) 100%)" }}
          >
            <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(255,255,255,0.6)" }}>
              <Sparkle size={28} weight="fill" style={{ color: "hsl(var(--accent))" }} />
            </div>
            <h3 className="font-serif text-[20px] font-medium">Your circle is quiet</h3>
            <p className="mt-2 font-mono text-[11px] text-muted-foreground leading-relaxed max-w-[220px] mx-auto">
              Invite a couple of friends and your network will naturally grow from there.
            </p>
            <Link
              to="/me"
              className="mt-5 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] bg-foreground text-background px-4 py-2 rounded-full"
            >
              Invite a friend <ArrowRight size={12} weight="bold" />
            </Link>
          </div>
        )}

        {/* Suggestion cards */}
        {items.map((p) => (
          <Link
            key={p.id}
            to={`/u/${p.handle}`}
            className="block rounded-[20px] border border-hairline bg-surface p-4 transition-shadow hover:shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-start gap-4">
              <Avatar name={p.display_name} src={p.avatar_url} size={64} ring />

              <div className="flex-1 min-w-0 pt-1">
                <p className="font-serif text-[18px] font-medium leading-tight truncate">
                  {p.display_name}
                </p>
                <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                  @{p.handle}
                </p>
                {p.viaLabels.length > 0 && (
                  <p className="mt-2 font-mono text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {p.viaLabels.map((v, i) => (
                      <span key={i}>
                        "{v.label}" of{" "}
                        <span className="text-foreground font-medium">{v.viaName}</span>
                        {i < p.viaLabels.length - 1 ? " · " : ""}
                      </span>
                    ))}
                  </p>
                )}
              </div>
            </div>

            {/* Footer row */}
            <div className="mt-3 pt-3 border-t border-dashed border-hairline flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Stacked mutual dots */}
                <div className="flex -space-x-1.5">
                  {Array.from({ length: Math.min(p.mutualCount, 4) }).map((_, i) => (
                    <div
                      key={i}
                      className="w-[18px] h-[18px] rounded-full border-2 border-background"
                      style={{ background: i % 2 === 0 ? "hsl(var(--accent-soft))" : "hsl(var(--clay-soft))", zIndex: 4 - i }}
                    />
                  ))}
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {p.mutualCount} mutual{p.mutualCount !== 1 ? "s" : ""}
                </span>
              </div>

              <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] bg-foreground text-background px-3 py-1.5 rounded-full">
                Connect <ArrowRight size={10} weight="bold" />
              </span>
            </div>
          </Link>
        ))}

        {/* Bottom breathing room */}
        {!loading && items.length > 0 && (
          <p className="pb-2 text-center font-mono text-[10px] tracking-[0.14em] uppercase text-muted-foreground">
            {items.length} suggestion{items.length !== 1 ? "s" : ""} · ranked by closeness
          </p>
        )}
      </div>
    </MobileShell>
  );
};

export default Circle;
