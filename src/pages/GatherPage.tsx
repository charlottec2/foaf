import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MobileShell } from "@/components/MobileShell";
import { ConnectionPath } from "@/components/ConnectionPath";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { shortestPath } from "@/lib/graph";
import { Calendar, ChevronLeft, MapPin, Users } from "lucide-react";
import { toast } from "sonner";

type Gather = {
  id: string;
  title: string;
  description: string | null;
  category: "social" | "professional" | "events";
  starts_at: string;
  location: string | null;
  size_cap: number;
  min_mutuals: number;
  host_id: string;
  source_group_id: string | null;
};

type Member = {
  id: string;
  user_id: string;
  status: "requested" | "approved" | "declined";
  profile: { id: string; handle: string; display_name: string };
  viewerLabel?: string | null;
};

const fmt = (s: string) =>
  new Date(s).toLocaleString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const GatherPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const nav = useNavigate();
  const [it, setIt] = useState<Gather | null>(null);
  const [host, setHost] = useState<{ id: string; handle: string; display_name: string } | null>(null);
  const [sourceGroupName, setSourceGroupName] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [pathNodes, setPathNodes] = useState<{ id: string; handle: string; display_name: string }[]>([]);
  const [myStatus, setMyStatus] = useState<Member["status"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [updates, setUpdates] = useState<{ id: string; body: string; created_at: string }[]>([]);
  const [updateBody, setUpdateBody] = useState("");

  const load = async () => {
    if (!id || !user) return;
    setLoading(true);
    const { data: g } = await supabase
      .from("gathers")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!g) {
      toast.error("Not visible to you, or it doesn't exist");
      setLoading(false);
      return;
    }
    setIt(g as any);
    const { data: h } = await supabase.from("profiles").select("id, handle, display_name").eq("id", (g as any).host_id).maybeSingle();
    setHost(h as any);

    if ((g as any).source_group_id) {
      const { data: gr } = await supabase.from("groups").select("name").eq("id", (g as any).source_group_id).maybeSingle();
      setSourceGroupName((gr as any)?.name ?? null);
    } else {
      setSourceGroupName(null);
    }

    if ((g as any).host_id === user.id) {
      setPathNodes([]);
    } else {
      const ids = (await shortestPath(user.id, (g as any).host_id, 4)) ?? [user.id, (g as any).host_id];
      const { data: pp } = await supabase.from("profiles").select("id, handle, display_name").in("id", ids);
      const pmap = new Map((pp ?? []).map((p: any) => [p.id, p]));
      setPathNodes(ids.map((nid) => pmap.get(nid) ?? { id: nid, handle: "?", display_name: "someone" }));
    }

    const { data: ms } = await supabase
      .from("gather_members")
      .select("id, user_id, status")
      .eq("gather_id", id);
    const memberIds = (ms ?? []).map((m: any) => m.user_id);
    const { data: mProfiles } = await supabase
      .from("profiles")
      .select("id, handle, display_name")
      .in("id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"]);
    const mProfMap = new Map((mProfiles ?? []).map((p: any) => [p.id, p]));

    const { data: viewerConns } = await supabase
      .from("connections")
      .select("requester_id, addressee_id, requester_label, addressee_label, status")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq("status", "accepted");
    const labelFor = (otherId: string) => {
      const c = (viewerConns ?? []).find(
        (x: any) =>
          (x.requester_id === user.id && x.addressee_id === otherId) ||
          (x.addressee_id === user.id && x.requester_id === otherId)
      );
      if (!c) return null;
      return (c as any).requester_id === user.id ? (c as any).addressee_label : (c as any).requester_label;
    };

    const enrichedMembers: Member[] = (ms ?? []).map((m: any) => ({
      id: m.id,
      user_id: m.user_id,
      status: m.status,
      profile: mProfMap.get(m.user_id) ?? { id: m.user_id, handle: "?", display_name: "Someone" },
      viewerLabel: labelFor(m.user_id),
    }));
    setMembers(enrichedMembers);
    const mine = enrichedMembers.find((m) => m.user_id === user.id);
    setMyStatus(mine?.status ?? null);

    const { data: ups } = await supabase
      .from("gather_updates")
      .select("id, body, created_at")
      .eq("gather_id", id)
      .order("created_at", { ascending: false });
    setUpdates((ups as any) ?? []);

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  const requestJoin = async () => {
    if (!id || !user) return;
    const { error } = await supabase.from("gather_members").insert({
      gather_id: id,
      user_id: user.id,
      status: "requested",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Request sent");
      load();
    }
  };

  const approve = async (memberId: string) => {
    const { error } = await supabase.from("gather_members").update({ status: "approved" }).eq("id", memberId);
    if (error) toast.error(error.message);
    else load();
  };
  const decline = async (memberId: string) => {
    const { error } = await supabase.from("gather_members").update({ status: "declined" }).eq("id", memberId);
    if (error) toast.error(error.message);
    else load();
  };

  const postUpdate = async () => {
    if (!it || !user || !updateBody.trim()) return;
    const { error } = await supabase.from("gather_updates").insert({
      gather_id: it.id,
      author_id: user.id,
      body: updateBody.trim(),
    });
    if (error) toast.error(error.message);
    else {
      setUpdateBody("");
      load();
    }
  };

  if (loading) {
    return (
      <MobileShell hideNav>
        <div className="container-mobile pt-10 font-mono text-xs text-muted-foreground">Loading…</div>
      </MobileShell>
    );
  }
  if (!it || !host) {
    return (
      <MobileShell hideNav>
        <div className="container-mobile pt-10">
          <p className="text-sm text-muted-foreground">This Gather isn't visible to you.</p>
          <Button onClick={() => nav("/")} className="mt-4">Home</Button>
        </div>
      </MobileShell>
    );
  }

  const isHost = it.host_id === user?.id;
  const approvedMembers = members.filter((m) => m.status === "approved");
  const pendingMembers = members.filter((m) => m.status === "requested");

  return (
    <MobileShell hideNav>
      <div className="container-mobile pt-6">
        <button onClick={() => nav(-1)} className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>

        <div className="mt-5 overflow-hidden rounded-3xl border border-hairline bg-surface">
          <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
            <span className="label-mono text-muted-foreground">{it.category.toUpperCase()}</span>
            <span className="font-mono text-[11px] text-muted-foreground">@{host.handle}</span>
          </div>
          <div className="px-5 pt-6 pb-5">
            <h1 className="text-[32px] font-bold leading-[1.05] tracking-tight">{it.title}</h1>
            {sourceGroupName && (
              <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                ↑ Opened from group · {sourceGroupName}
              </p>
            )}
            {it.description && <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{it.description}</p>}

            <div className="mt-6 flex flex-col gap-2 font-mono text-[13px]">
              <div className="flex items-center gap-2.5"><Calendar className="h-4 w-4" />{fmt(it.starts_at)}</div>
              {it.location && <div className="flex items-center gap-2.5"><MapPin className="h-4 w-4" />{it.location}</div>}
              <div className="flex items-center gap-2.5"><Users className="h-4 w-4" />{approvedMembers.length}/{it.size_cap} going · min {it.min_mutuals} mutual</div>
            </div>

            {pathNodes.length > 0 && (
              <div className="mt-5 border-t border-hairline pt-4">
                <ConnectionPath nodes={pathNodes} prefix="HOW YOU KNOW THEM" />
              </div>
            )}
          </div>
        </div>

        {!isHost && (
          <div className="mt-5">
            {myStatus === "approved" ? (
              <div className="rounded-xl border border-signal/40 bg-signal/10 px-4 py-3 text-center font-mono text-[12px] text-signal">YOU'RE IN</div>
            ) : myStatus === "requested" ? (
              <div className="rounded-xl border border-hairline bg-surface px-4 py-3 text-center font-mono text-[12px] text-muted-foreground">REQUEST PENDING</div>
            ) : myStatus === "declined" ? (
              <div className="rounded-xl border border-hairline bg-surface px-4 py-3 text-center font-mono text-[12px] text-muted-foreground">REQUEST DECLINED</div>
            ) : (
              <Button onClick={requestJoin} className="h-12 w-full">Request to join</Button>
            )}
          </div>
        )}

        {isHost && pendingMembers.length > 0 && (
          <section className="mt-6">
            <p className="label-mono mb-2 text-muted-foreground">REQUESTS · {pendingMembers.length}</p>
            <div className="flex flex-col gap-2">
              {pendingMembers.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-xl border border-hairline bg-surface px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{m.profile.display_name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">@{m.profile.handle}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => decline(m.id)} className="rounded-md border border-hairline px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">No</button>
                    <button onClick={() => approve(m.id)} className="rounded-md bg-primary px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-primary-foreground">Approve</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6">
          <p className="label-mono mb-2 text-muted-foreground">GOING · {approvedMembers.length}</p>
          {approvedMembers.length === 0 && (
            <p className="text-sm text-muted-foreground">No one yet. Be the first.</p>
          )}
          <div className="flex flex-col gap-2">
            {approvedMembers.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-xl border border-hairline bg-surface px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{m.profile.display_name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">@{m.profile.handle}</p>
                </div>
                {m.viewerLabel ? (
                  <span className="rounded-full bg-primary px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-primary-foreground">
                    {m.viewerLabel}
                  </span>
                ) : (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">friend of friend</span>
                )}
              </div>
            ))}
          </div>
        </section>

        {(isHost || myStatus === "approved") && (
          <section className="mt-6">
            <p className="label-mono mb-2 text-muted-foreground">UPDATES</p>
            {isHost && (
              <div className="mb-3 rounded-xl border border-hairline bg-surface p-3">
                <Textarea value={updateBody} onChange={(e) => setUpdateBody(e.target.value)} rows={2} placeholder="Drop an update for the group…" className="border-0 bg-transparent p-0 focus-visible:ring-0" />
                <div className="mt-2 flex justify-end">
                  <Button size="sm" onClick={postUpdate} disabled={!updateBody.trim()}>Post</Button>
                </div>
              </div>
            )}
            {updates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No updates yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {updates.map((u) => (
                  <div key={u.id} className="rounded-xl border border-hairline bg-surface px-3 py-2.5">
                    <p className="text-sm">{u.body}</p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {new Date(u.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </MobileShell>
  );
};

export default GatherPage;
