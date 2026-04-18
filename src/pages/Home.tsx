import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { GatherCard } from "@/components/GatherCard";
import { loadEnrichedGathers, EnrichedGather } from "@/lib/gathers";
import { Link } from "react-router-dom";
import { CalendarPlus, MessageCircle, Users } from "lucide-react";

type GroupActivity = {
  id: string;
  group_id: string;
  group_name: string;
  body: string;
  author_name: string;
  created_at: string;
};

const Home = () => {
  const { user, profile } = useAuth();
  const [gathers, setGathers] = useState<EnrichedGather[]>([]);
  const [groupActivity, setGroupActivity] = useState<GroupActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [g, ga] = await Promise.all([
        loadEnrichedGathers(user.id, { upcomingOnly: true }),
        (async () => {
          // Load recent posts from groups the user belongs to
          const { data: posts } = await supabase
            .from("group_posts")
            .select("id, group_id, body, author_id, created_at")
            .order("created_at", { ascending: false })
            .limit(15);
          if (!posts || posts.length === 0) return [] as GroupActivity[];
          const groupIds = Array.from(new Set(posts.map((p: any) => p.group_id)));
          const authorIds = Array.from(new Set(posts.map((p: any) => p.author_id)));
          const [{ data: groups }, { data: authors }] = await Promise.all([
            supabase.from("groups").select("id, name").in("id", groupIds),
            supabase.from("profiles").select("id, display_name").in("id", authorIds),
          ]);
          const gmap = new Map((groups ?? []).map((g: any) => [g.id, g.name]));
          const amap = new Map((authors ?? []).map((a: any) => [a.id, a.display_name]));
          return posts.map((p: any) => ({
            id: p.id,
            group_id: p.group_id,
            group_name: gmap.get(p.group_id) ?? "Group",
            body: p.body,
            author_name: amap.get(p.author_id) ?? "Someone",
            created_at: p.created_at,
          }));
        })(),
      ]);
      setGathers(g);
      setGroupActivity(ga);
      setLoading(false);
    })();
  }, [user]);

  return (
    <MobileShell>
      <header className="container-mobile sticky top-0 z-30 -mx-4 mb-2 bg-background/95 px-4 pt-6 pb-3 backdrop-blur">
        <p className="label-mono text-muted-foreground">HOME</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          {profile ? `Hi, ${profile.display_name.split(" ")[0]}` : "Welcome"}
        </h1>
      </header>

      <section className="container-mobile flex flex-col gap-4">
        {loading && <p className="font-mono text-xs text-muted-foreground">Loading…</p>}

        {!loading && groupActivity.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="label-mono text-muted-foreground">FROM YOUR GROUPS</p>
            {groupActivity.slice(0, 3).map((p) => (
              <Link
                key={p.id}
                to={`/groups/${p.group_id}`}
                className="block rounded-2xl border border-hairline bg-surface px-4 py-3 transition hover:border-foreground/40"
              >
                <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>{p.group_name}</span>
                  <span>·</span>
                  <span>{p.author_name}</span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-sm">{p.body}</p>
              </Link>
            ))}
          </div>
        )}

        {!loading && (
          <div className="flex items-end justify-between pt-2">
            <p className="label-mono text-muted-foreground">UPCOMING GATHERS</p>
            <Link
              to="/gather/new"
              className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            >
              <CalendarPlus className="h-3.5 w-3.5" /> Host
            </Link>
          </div>
        )}

        {!loading && gathers.length === 0 && (
          <div className="rounded-2xl border border-dashed border-hairline p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Quiet for now. Connect with more friends to unlock more of the world — or post the first Gather.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link to="/circle" className="rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground">
                Grow your Circle
              </Link>
              <Link to="/gather/new" className="rounded-full border border-hairline py-2.5 text-sm font-medium">
                Host a Gather
              </Link>
            </div>
          </div>
        )}

        {gathers.map((it) => (
          <GatherCard key={it.id} it={it} />
        ))}

        {!loading && gathers.length > 0 && (
          <Link to="/groups" className="mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-hairline py-2.5 text-sm font-medium text-muted-foreground">
            <Users className="h-4 w-4" /> View all groups
          </Link>
        )}
      </section>
    </MobileShell>
  );
};

export default Home;
