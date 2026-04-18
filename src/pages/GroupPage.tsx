import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, Megaphone, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { getDirectConnections } from "@/lib/graph";

type Group = { id: string; name: string; description: string | null; creator_id: string };
type Member = {
  id: string;
  user_id: string;
  status: "invited" | "member" | "declined";
  profile: { id: string; handle: string; display_name: string };
};
type Post = { id: string; body: string; created_at: string; author: { display_name: string; handle: string } };

const GroupPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const nav = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [connectionOptions, setConnectionOptions] = useState<{ id: string; handle: string; display_name: string }[]>([]);

  const load = async () => {
    if (!id || !user) return;
    setLoading(true);
    const { data: g } = await supabase.from("groups").select("*").eq("id", id).maybeSingle();
    if (!g) { setLoading(false); return; }
    setGroup(g as any);

    const { data: ms } = await supabase
      .from("group_members")
      .select("id, user_id, status")
      .eq("group_id", id)
      .order("created_at", { ascending: true });
    const memberIds = (ms ?? []).map((m: any) => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, handle, display_name")
      .in("id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"]);
    const pm = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    setMembers(
      (ms ?? []).map((m: any) => ({
        ...m,
        profile: pm.get(m.user_id) ?? { id: m.user_id, handle: "?", display_name: "Someone" },
      }))
    );

    const { data: ps } = await supabase
      .from("group_posts")
      .select("id, body, author_id, created_at")
      .eq("group_id", id)
      .order("created_at", { ascending: false });
    const authorIds = Array.from(new Set((ps ?? []).map((p: any) => p.author_id)));
    const { data: authors } = await supabase
      .from("profiles")
      .select("id, handle, display_name")
      .in("id", authorIds.length ? authorIds : ["00000000-0000-0000-0000-000000000000"]);
    const am = new Map((authors ?? []).map((a: any) => [a.id, a]));
    setPosts(
      (ps ?? []).map((p: any) => ({
        id: p.id,
        body: p.body,
        created_at: p.created_at,
        author: am.get(p.author_id) ?? { handle: "?", display_name: "Someone" },
      }))
    );

    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id, user?.id]);

  const post = async () => {
    if (!id || !user || !body.trim()) return;
    const { error } = await supabase.from("group_posts").insert({
      group_id: id,
      author_id: user.id,
      body: body.trim(),
    });
    if (error) toast.error(error.message);
    else { setBody(""); load(); }
  };

  const openInvite = async () => {
    if (!user) return;
    const conns = await getDirectConnections(user.id);
    const existing = new Set(members.map((m) => m.user_id));
    const candidates = conns.filter((c) => !existing.has(c));
    if (candidates.length === 0) {
      setConnectionOptions([]);
      setShowInvite(true);
      return;
    }
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, handle, display_name")
      .in("id", candidates);
    setConnectionOptions((profiles as any) ?? []);
    setShowInvite(true);
  };

  const inviteUser = async (uid: string) => {
    if (!id) return;
    const { error } = await supabase.from("group_members").insert({
      group_id: id,
      user_id: uid,
      status: "member", // direct add — they're already a connection
    });
    if (error) toast.error(error.message);
    else { toast.success("Added"); setConnectionOptions((s) => s.filter((p) => p.id !== uid)); load(); }
  };

  if (loading) {
    return <MobileShell hideNav><div className="container-mobile pt-10 font-mono text-xs text-muted-foreground">Loading…</div></MobileShell>;
  }
  if (!group) {
    return (
      <MobileShell hideNav>
        <div className="container-mobile pt-10">
          <p className="text-sm text-muted-foreground">This group isn't visible to you.</p>
          <Button onClick={() => nav("/groups")} className="mt-4">Back to Groups</Button>
        </div>
      </MobileShell>
    );
  }

  const isCreator = user?.id === group.creator_id;
  const activeMembers = members.filter((m) => m.status === "member");

  return (
    <MobileShell hideNav>
      <div className="container-mobile pt-6">
        <Link to="/groups" className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Groups
        </Link>

        <header className="mt-4">
          <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
          {group.description && <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>}
          <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {activeMembers.length} member{activeMembers.length === 1 ? "" : "s"}
          </p>
        </header>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {isCreator && (
            <button onClick={openInvite} className="flex items-center justify-center gap-1.5 rounded-full border border-hairline py-2.5 text-xs font-medium">
              <UserPlus className="h-4 w-4" /> Invite
            </button>
          )}
          <Link
            to={`/gather/new?fromGroup=${group.id}`}
            className={`flex items-center justify-center gap-1.5 rounded-full bg-primary py-2.5 text-xs font-medium text-primary-foreground ${isCreator ? "" : "col-span-2"}`}
          >
            <Megaphone className="h-4 w-4" /> Open as Gather
          </Link>
        </div>

        {/* Compose */}
        <div className="mt-6 rounded-2xl border border-hairline bg-surface p-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="Share an update with the group…"
            className="border-0 bg-transparent p-0 focus-visible:ring-0"
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" onClick={post} disabled={!body.trim()}>Post</Button>
          </div>
        </div>

        {/* Posts */}
        <section className="mt-5">
          <p className="label-mono mb-2 text-muted-foreground">UPDATES</p>
          {posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No updates yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {posts.map((p) => (
                <div key={p.id} className="rounded-xl border border-hairline bg-surface px-3 py-2.5">
                  <p className="text-sm">{p.body}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {p.author.display_name} · {new Date(p.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Members */}
        <section className="mt-6">
          <p className="label-mono mb-2 text-muted-foreground">MEMBERS</p>
          <div className="flex flex-col gap-2">
            {activeMembers.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-xl border border-hairline bg-surface px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{m.profile.display_name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">@{m.profile.handle}</p>
                </div>
                {m.user_id === group.creator_id && (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">CREATOR</span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Invite modal-ish */}
        {showInvite && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4" onClick={() => setShowInvite(false)}>
            <div className="w-full max-w-[480px] rounded-2xl border border-hairline bg-background p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <p className="label-mono text-muted-foreground">INVITE FROM YOUR CIRCLE</p>
                <button onClick={() => setShowInvite(false)} aria-label="Close"><X className="h-4 w-4" /></button>
              </div>
              <div className="mt-3 flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
                {connectionOptions.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No connections to add. Grow your Circle first.
                  </p>
                ) : (
                  connectionOptions.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => inviteUser(p.id)}
                      className="flex items-center justify-between rounded-xl border border-hairline px-3 py-2.5 text-left transition hover:border-foreground/40"
                    >
                      <div>
                        <p className="text-sm font-medium">{p.display_name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">@{p.handle}</p>
                      </div>
                      <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Add</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </MobileShell>
  );
};

export default GroupPage;
