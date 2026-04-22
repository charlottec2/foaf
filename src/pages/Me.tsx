import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateInviteCode } from "@/lib/invite";
import { toast } from "sonner";
import { Copy, Share2 } from "lucide-react";

type Conn = {
  id: string;
  requester_id: string;
  addressee_id: string;
  requester_label: string | null;
  addressee_label: string | null;
  status: "pending" | "accepted" | "declined";
  iAmRequester: boolean;
  other: { id: string; handle: string; display_name: string };
};

const Me = () => {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [stats, setStats] = useState({ connections: 0, hosting: 0, joined: 0, groups: 0 });
  const [codes, setCodes] = useState<{ code: string; used_by: string | null }[]>([]);
  const [incoming, setIncoming] = useState<Conn[]>([]);
  const [acceptLabel, setAcceptLabel] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name);
      setBio(profile.bio ?? "");
    }
  }, [profile]);

  const loadAll = async () => {
    if (!user) return;
    const [{ count: c1 }, { count: c2 }, { count: c3 }, { count: c4 }] = await Promise.all([
      supabase.from("connections").select("id", { count: "exact", head: true })
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`).eq("status", "accepted"),
      supabase.from("gathers").select("id", { count: "exact", head: true }).eq("host_id", user.id),
      supabase.from("gather_members").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "approved"),
      supabase.from("group_members").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "member"),
    ]);
    setStats({ connections: c1 ?? 0, hosting: c2 ?? 0, joined: c3 ?? 0, groups: c4 ?? 0 });

    const { data: cd } = await supabase
      .from("invite_codes")
      .select("code, used_by")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });
    setCodes(cd ?? []);

    // Incoming connection requests
    const { data: incRows } = await supabase
      .from("connections")
      .select("*")
      .eq("addressee_id", user.id)
      .eq("status", "pending");
    const otherIds = (incRows ?? []).map((c: any) => c.requester_id);
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, handle, display_name")
      .in("id", otherIds.length ? otherIds : ["00000000-0000-0000-0000-000000000000"]);
    const pm = new Map((profs ?? []).map((p: any) => [p.id, p]));
    setIncoming(
      (incRows ?? []).map((c: any) => ({
        ...c,
        iAmRequester: false,
        other: pm.get(c.requester_id) ?? { id: "?", handle: "?", display_name: "?" },
      }))
    );
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [user?.id]);

  const newCode = async () => {
    if (!user) return;
    const code = generateInviteCode();
    const { error } = await supabase.from("invite_codes").insert({ code, created_by: user.id });
    if (error) toast.error(error.message);
    else { toast.success("Invite created"); loadAll(); }
  };
  const inviteLink = (code: string) => `${window.location.origin}/auth?code=${encodeURIComponent(code)}`;
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success("Copied"); } catch { toast.error("Couldn't copy"); }
  };
  const share = async (code: string) => {
    const url = inviteLink(code);
    const text = `Join me on Friend of a Friend — code ${code}`;
    if ((navigator as any).share) {
      try { await (navigator as any).share({ title: "Friend of a Friend", text, url }); } catch {}
    } else { copy(url); }
  };

  const accept = async (c: Conn) => {
    const label = (acceptLabel[c.id] ?? "").trim();
    if (label.split(/\s+/).filter(Boolean).length !== 2) {
      toast.error("Use exactly 2 words");
      return;
    }
    const { error } = await supabase
      .from("connections")
      .update({ status: "accepted", addressee_label: label })
      .eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success("Connected"); loadAll(); }
  };
  const decline = async (c: Conn) => {
    const { error } = await supabase.from("connections").update({ status: "declined" }).eq("id", c.id);
    if (error) toast.error(error.message);
    else loadAll();
  };

  const save = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim(), bio: bio.trim() || null })
      .eq("id", user.id);
    if (error) toast.error(error.message);
    else { toast.success("Saved"); refreshProfile(); }
  };

  return (
    <MobileShell>
      <div className="container-mobile pt-6">
        <p className="label-mono text-muted-foreground">PROFILE</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{profile?.display_name}</h1>
        <p className="font-mono text-[12px] text-muted-foreground">@{profile?.handle}</p>

        <div className="mt-5 grid grid-cols-4 gap-2">
          {[
            ["Conns", stats.connections],
            ["Groups", stats.groups],
            ["Hosting", stats.hosting],
            ["Going", stats.joined],
          ].map(([label, n]) => (
            <div key={label as string} className="rounded-xl border border-hairline bg-surface px-2 py-3 text-center">
              <p className="text-xl font-bold">{n}</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Incoming connection requests */}
        {incoming.length > 0 && (
          <section className="mt-6">
            <p className="label-mono mb-2 text-muted-foreground">INCOMING REQUESTS</p>
            <div className="flex flex-col gap-2">
              {incoming.map((c) => (
                <div key={c.id} className="rounded-xl border border-hairline bg-surface p-3">
                  <p className="text-sm font-medium">{c.other.display_name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">@{c.other.handle} · they said: "{c.requester_label}"</p>
                  <div className="mt-3 flex gap-2">
                    <Input
                      value={acceptLabel[c.id] ?? ""}
                      onChange={(e) => setAcceptLabel((s) => ({ ...s, [c.id]: e.target.value }))}
                      placeholder="2-word label"
                      className="flex-1"
                    />
                    <Button size="sm" onClick={() => accept(c)}>Accept</Button>
                    <Button size="sm" variant="ghost" onClick={() => decline(c)}>No</Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Invites */}
        <section className="mt-6 rounded-2xl border border-hairline bg-surface p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Invite a friend</p>
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                Single-use codes. They auto-connect with you.
              </p>
            </div>
            <Button size="sm" onClick={newCode}>New</Button>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {codes.length === 0 && <p className="font-mono text-[11px] text-muted-foreground">No codes yet.</p>}
            {codes.map((c) => (
              <div key={c.code} className="flex items-center gap-2 rounded-lg border border-hairline bg-background px-3 py-2">
                <code className="flex-1 truncate text-[12px]">{c.code}</code>
                {c.used_by ? (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">USED</span>
                ) : (
                  <>
                    <button onClick={() => copy(inviteLink(c.code))} className="text-muted-foreground hover:text-foreground" aria-label="Copy link"><Copy className="h-4 w-4" /></button>
                    <button onClick={() => share(c.code)} className="text-muted-foreground hover:text-foreground" aria-label="Share"><Share2 className="h-4 w-4" /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Edit */}
        <section className="mt-6 flex flex-col gap-3">
          <p className="label-mono text-muted-foreground">EDIT PROFILE</p>
          <div>
            <Label htmlFor="dn" className="label-mono text-muted-foreground">Display name</Label>
            <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="bio" className="label-mono text-muted-foreground">Bio</Label>
            <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="mt-1.5" />
          </div>
          <Button onClick={save} className="mt-3 h-12">Save</Button>
          <Button onClick={signOut} variant="ghost" className="text-muted-foreground">Sign out</Button>
        </section>
      </div>
    </MobileShell>
  );
};

export default Me;
