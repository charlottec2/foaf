import { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";

type Cat = "social" | "professional" | "events";

const NewGather = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const fromGroupId = params.get("fromGroup");

  const [groupName, setGroupName] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Cat>("social");
  const [startsAt, setStartsAt] = useState("");
  const [location, setLocation] = useState("");
  const [sizeCap, setSizeCap] = useState(8);
  const [minMutuals, setMinMutuals] = useState(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!fromGroupId) return;
    (async () => {
      const { data } = await supabase.from("groups").select("name").eq("id", fromGroupId).maybeSingle();
      if (data) setGroupName((data as any).name);
    })();
  }, [fromGroupId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("gathers")
      .insert({
        host_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        category,
        starts_at: new Date(startsAt).toISOString(),
        location: location.trim() || null,
        size_cap: sizeCap,
        min_mutuals: minMutuals,
        source_group_id: fromGroupId,
      })
      .select("id")
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Couldn't create");
      setBusy(false);
      return;
    }

    const newId = (data as any).id;

    // If spawned from a group, auto-approve all current group members as attendees.
    if (fromGroupId) {
      const { data: members } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", fromGroupId)
        .eq("status", "member");
      const rows = (members ?? []).map((m: any) => ({
        gather_id: newId,
        user_id: m.user_id,
        status: "approved" as const,
      }));
      // Ensure host is in there too
      if (!rows.find((r) => r.user_id === user.id)) {
        rows.push({ gather_id: newId, user_id: user.id, status: "approved" as const });
      }
      if (rows.length) {
        await supabase.from("gather_members").upsert(rows, { onConflict: "gather_id,user_id" });
      }
    }

    setBusy(false);
    toast.success("Gather posted");
    nav(`/g/${newId}`, { replace: true });
  };

  return (
    <MobileShell hideNav>
      <div className="container-mobile pt-6">
        <Link to={fromGroupId ? `/groups/${fromGroupId}` : "/gather"} className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">New Gather</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {groupName ? (
            <>Opening to friends-of-friends from <span className="font-medium text-foreground">{groupName}</span>. Group members are auto-approved.</>
          ) : (
            <>Visible only to people who share enough mutual connections with you.</>
          )}
        </p>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          <div>
            <Label htmlFor="t" className="label-mono text-muted-foreground">Title</Label>
            <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} required className="mt-1.5" placeholder="Sunday long run, 8am" />
          </div>
          <div>
            <Label htmlFor="d" className="label-mono text-muted-foreground">Description</Label>
            <Textarea id="d" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="mt-1.5" placeholder="What's the vibe?" />
          </div>
          <div>
            <Label className="label-mono text-muted-foreground">Category</Label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {(["social", "professional", "events"] as Cat[]).map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded-lg border px-3 py-2 text-xs uppercase tracking-wider font-mono ${category === c ? "border-foreground bg-foreground text-background" : "border-hairline text-muted-foreground"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="s" className="label-mono text-muted-foreground">Date & time</Label>
              <Input id="s" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="loc" className="label-mono text-muted-foreground">Location</Label>
              <Input id="loc" value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1.5" placeholder="Hyde Park" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cap" className="label-mono text-muted-foreground">Size cap</Label>
              <Input id="cap" type="number" min={1} max={200} value={sizeCap} onChange={(e) => setSizeCap(parseInt(e.target.value || "1"))} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="mm" className="label-mono text-muted-foreground">Min mutuals</Label>
              <Input id="mm" type="number" min={0} max={10} value={minMutuals} onChange={(e) => setMinMutuals(parseInt(e.target.value || "0"))} className="mt-1.5" />
            </div>
          </div>
          <p className="font-mono text-[11px] text-muted-foreground">
            Higher mutual = stricter trust gate. 0 means anyone in your extended graph can see it.
          </p>
          <Button type="submit" disabled={busy} className="mt-4 h-12">{busy ? "…" : "Post Gather"}</Button>
        </form>
      </div>
    </MobileShell>
  );
};

export default NewGather;
