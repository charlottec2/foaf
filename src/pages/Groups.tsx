import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Users, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  creator_id: string;
  memberCount: number;
};

const Groups = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    // RLS: returns groups where I'm the creator OR a member/invited
    const { data: gs } = await supabase
      .from("groups")
      .select("id, name, description, creator_id")
      .order("created_at", { ascending: false });
    if (!gs) return setGroups([]);
    if (gs.length === 0) return setGroups([]);
    const ids = gs.map((g: any) => g.id);
    const { data: ms } = await supabase
      .from("group_members")
      .select("group_id, status")
      .in("group_id", ids)
      .eq("status", "member");
    const counts = new Map<string, number>();
    (ms ?? []).forEach((m: any) => counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1));
    setGroups(gs.map((g: any) => ({ ...g, memberCount: counts.get(g.id) ?? 0 })));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("groups")
      .insert({ name: name.trim(), description: description.trim() || null, creator_id: user.id })
      .select("id")
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Couldn't create");
      setBusy(false);
      return;
    }
    // Add creator as a member
    await supabase.from("group_members").insert({
      group_id: (data as any).id,
      user_id: user.id,
      status: "member",
    });
    setBusy(false);
    setCreating(false);
    setName("");
    setDescription("");
    nav(`/groups/${(data as any).id}`);
  };

  return (
    <MobileShell>
      <header className="container-mobile sticky top-0 z-30 -mx-4 mb-3 bg-background/95 px-4 pt-6 pb-3 backdrop-blur">
        <div className="flex items-end justify-between">
          <div>
            <p className="label-mono text-muted-foreground">GROUPS</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Your private spaces</h1>
          </div>
          <button
            onClick={() => setCreating((s) => !s)}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> New
          </button>
        </div>
      </header>

      <section className="container-mobile flex flex-col gap-3">
        {creating && (
          <form onSubmit={create} className="rounded-2xl border border-hairline bg-surface p-4">
            <p className="label-mono mb-2 text-muted-foreground">NEW GROUP</p>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sunday runners" required />
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this group for? (optional)" rows={2} className="mt-2" />
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? "…" : "Create"}</Button>
            </div>
          </form>
        )}

        {groups.length === 0 && !creating && (
          <div className="rounded-2xl border border-dashed border-hairline p-6 text-center">
            <Users className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Make a private space for the people you already know. When you're ready, open any plan to friends-of-friends as a Gather.
            </p>
            <Button onClick={() => setCreating(true)} className="mt-4">Create your first group</Button>
          </div>
        )}

        {groups.map((g) => (
          <Link key={g.id} to={`/groups/${g.id}`} className="flex items-center justify-between rounded-2xl border border-hairline bg-surface px-4 py-3 transition hover:border-foreground/40">
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold">{g.name}</p>
              {g.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{g.description}</p>}
              <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{g.memberCount} member{g.memberCount === 1 ? "" : "s"}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </section>
    </MobileShell>
  );
};

export default Groups;
