import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { ConnectionChain, type ChainNode } from "@/components/ConnectionChain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { generateInviteCode } from "@/lib/invite";
import { shortestPath } from "@/lib/graph";
import { toast } from "sonner";
import { Camera, ArrowUp, ShareNetwork, Copy, Share } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type Conn = {
  id: string;
  requester_id: string;
  addressee_id: string;
  requester_label: string | null;
  status: "pending" | "accepted" | "declined";
  other: { id: string; handle: string; display_name: string };
};

const Me = () => {
  const { user, profile, signOut, refreshProfile } = useAuth();

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  const [stats, setStats] = useState({ connections: 0, hosting: 0, joined: 0, groups: 0 });
  const [codes, setCodes] = useState<{ code: string; used_by: string | null }[]>([]);
  const [incoming, setIncoming] = useState<Conn[]>([]);
  const [acceptWords, setAcceptWords] = useState<Record<string, [string, string]>>({});

  const [chain, setChain] = useState<ChainNode[]>([]);
  const [chainLoading, setChainLoading] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name);
      setBio(profile.bio ?? "");
      setAvatarUrl(profile.avatar_url ?? null);
      setBannerUrl(profile.banner_url ?? null);
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
      .from("invite_codes").select("code, used_by").eq("created_by", user.id)
      .order("created_at", { ascending: false });
    setCodes(cd ?? []);

    const { data: incRows } = await supabase
      .from("connections").select("*").eq("addressee_id", user.id).eq("status", "pending");
    const otherIds = (incRows ?? []).map((c: any) => c.requester_id);
    const { data: profs } = await supabase.from("profiles").select("id, handle, display_name")
      .in("id", otherIds.length ? otherIds : ["00000000-0000-0000-0000-000000000000"]);
    const pm = new Map((profs ?? []).map((p: any) => [p.id, p]));
    setIncoming(
      (incRows ?? []).map((c: any) => ({
        ...c,
        other: pm.get(c.requester_id) ?? { id: "?", handle: "?", display_name: "?" },
      }))
    );
  };

  useEffect(() => { loadAll(); }, [user?.id]); // eslint-disable-line

  // Load connection chain — longest path via recent connections
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setChainLoading(true);
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from("connections").select("requester_id, addressee_id, requester_label, addressee_label")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq("status", "accepted").gte("updated_at", since).limit(5);

      if (!recent || recent.length === 0 || cancelled) { setChainLoading(false); return; }

      let bestPath: string[] | null = null;
      for (const conn of recent) {
        const otherId = conn.requester_id === user.id ? conn.addressee_id : conn.requester_id;
        const path = await shortestPath(user.id, otherId, 4);
        if (path && (!bestPath || path.length > bestPath.length)) bestPath = path;
      }

      if (!bestPath || cancelled) { setChainLoading(false); return; }

      const { data: pathProfiles } = await supabase
        .from("profiles").select("id, display_name, handle, avatar_url").in("id", bestPath);
      const pm = new Map((pathProfiles ?? []).map((p: any) => [p.id, p]));

      const nodes: ChainNode[] = bestPath.map((id) => {
        const p = pm.get(id);
        return { id, display_name: p?.display_name ?? "?", handle: p?.handle ?? "?", avatar_url: p?.avatar_url ?? null };
      });

      if (!cancelled) setChain(nodes);
      setChainLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line

  const uploadFile = async (file: File, path: string) => {
    const { data, error } = await supabase.storage.from("profile-media")
      .upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); return null; }
    return supabase.storage.from("profile-media").getPublicUrl(data.path).data.publicUrl;
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const ext = file.name.split(".").pop();
    const url = await uploadFile(file, `${user.id}/avatar-${Date.now()}.${ext}`);
    if (!url) return;
    await supabase.from("profiles").update({ avatar_url: url } as any).eq("id", user.id);
    setAvatarUrl(url);
    refreshProfile();
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const ext = file.name.split(".").pop();
    const url = await uploadFile(file, `${user.id}/banner-${Date.now()}.${ext}`);
    if (!url) return;
    await supabase.from("profiles").update({ banner_url: url } as any).eq("id", user.id);
    setBannerUrl(url);
    refreshProfile();
  };

  const handleSave = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles")
      .update({ display_name: displayName.trim(), bio: bio.trim() || null }).eq("id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    refreshProfile();
    setEditing(false);
  };

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

  const shareCode = async (code: string) => {
    const url = inviteLink(code);
    if ((navigator as any).share) {
      try { await (navigator as any).share({ title: "Friend of a Friend", text: `Join me — code ${code}`, url }); } catch {}
    } else { copy(url); }
  };

  const accept = async (c: Conn) => {
    const [w1, w2] = acceptWords[c.id] ?? ["", ""];
    if (!w1.trim() || !w2.trim()) { toast.error("Fill in both words"); return; }
    const { error } = await supabase.from("connections")
      .update({ status: "accepted", addressee_label: `${w1.trim()} ${w2.trim()}` }).eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success("Connected"); loadAll(); }
  };

  const decline = async (c: Conn) => {
    await supabase.from("connections").update({ status: "declined" }).eq("id", c.id);
    loadAll();
  };

  return (
    <MobileShell>
      {/* Banner */}
      <div className="relative overflow-hidden" style={{ height: 160, borderBottom: "1px solid hsl(var(--hairline))" }}>
        {bannerUrl ? (
          <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full relative"
            style={{ background: "linear-gradient(135deg, hsl(var(--butter)) 0%, hsl(var(--accent)) 55%, hsl(var(--clay)) 100%)" }}
          >
            {/* Decorative SVG overlay */}
            <svg className="absolute inset-0 w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
              <line x1="10%" y1="30%" x2="40%" y2="70%" stroke="white" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="40%" y1="70%" x2="75%" y2="40%" stroke="white" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="75%" y1="40%" x2="95%" y2="65%" stroke="white" strokeWidth="1" strokeDasharray="4 4" />
              <circle cx="10%" cy="30%" r="4" fill="white" />
              <circle cx="40%" cy="70%" r="4" fill="white" />
              <circle cx="75%" cy="40%" r="4" fill="white" />
              <circle cx="95%" cy="65%" r="4" fill="white" />
            </svg>
          </div>
        )}

        {/* Top controls */}
        <div className="absolute top-3 inset-x-4 z-10 flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-[0.16em] uppercase bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full">
            Profile
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => editing ? handleSave() : setEditing(true)}
              className={cn(
                "font-mono text-[10px] tracking-[0.14em] uppercase px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors",
                editing ? "bg-foreground text-background" : "bg-white/90 text-foreground"
              )}
            >
              {editing ? "Done" : "Edit"}
            </button>
            <button
              onClick={() => copy(`${window.location.origin}/u/${profile?.handle}`)}
              className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center"
              aria-label="Share profile"
            >
              <ShareNetwork size={14} />
            </button>
          </div>
        </div>

        {/* Change banner (editing only) */}
        {editing && (
          <button
            onClick={() => bannerInputRef.current?.click()}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white px-3 py-1.5 rounded-full"
            style={{ background: "rgba(31,26,18,0.75)", backdropFilter: "blur(4px)" }}
          >
            <Camera size={12} />
            Change
          </button>
        )}
        <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
      </div>

      {/* Hero row */}
      <div className="-mt-5 px-5 pb-7 flex items-end gap-4">
        <div
          className={cn("relative shrink-0", editing && "cursor-pointer")}
          onClick={editing ? () => avatarInputRef.current?.click() : undefined}
        >
          <div
            className="w-[84px] h-[84px] rounded-full overflow-hidden bg-clay-soft flex items-center justify-center"
            style={{ boxShadow: "0 0 0 1.5px hsl(var(--accent)), 0 0 0 5px hsl(var(--background))" }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="font-serif text-3xl text-foreground">
                {profile?.display_name?.[0]?.toUpperCase()}
              </span>
            )}
          </div>
          {editing && (
            <div
              className="absolute bottom-[-2px] right-[-2px] w-6 h-6 rounded-full bg-foreground border-2 border-background flex items-center justify-center"
            >
              <ArrowUp size={10} weight="bold" className="text-background" />
            </div>
          )}
        </div>

        <div className="flex-1 pb-1 min-w-0">
          {editing ? (
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="font-serif text-[28px] font-medium tracking-tight leading-[1.05] border-0 border-b-2 border-dashed bg-transparent outline-none w-full"
              style={{ borderColor: "hsl(var(--accent))" }}
            />
          ) : (
            <h1 className="font-serif text-[28px] font-medium tracking-tight leading-[1.05]">
              {profile?.display_name}
            </h1>
          )}
          <p className="mt-1 font-mono text-[11.5px] text-muted-foreground">@{profile?.handle}</p>
        </div>

        <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
      </div>

      {/* Bio */}
      <div className="px-5 pb-[18px]">
        {editing ? (
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell your story…"
            rows={2}
            className="font-serif italic text-[15px] leading-[1.45] border-dashed bg-transparent resize-none"
            style={{ borderColor: "hsl(var(--accent))" }}
          />
        ) : bio ? (
          <p className="font-serif italic text-[15px] leading-[1.45] text-foreground">{bio}</p>
        ) : null}
      </div>

      {/* Connection chain */}
      <ConnectionChain nodes={chain} loading={chainLoading} />

      {/* Stats */}
      <div className="px-5 pb-[22px] grid grid-cols-4 gap-2">
        {[
          { label: "Conns", value: stats.connections },
          { label: "Groups", value: stats.groups },
          { label: "Hosting", value: stats.hosting, accent: true },
          { label: "Going", value: stats.joined },
        ].map(({ label, value, accent }) => (
          <div
            key={label}
            className={cn("rounded-[18px] border border-hairline p-3 text-center", accent ? "bg-accent-soft" : "bg-surface")}
          >
            <p className="font-serif text-[26px] font-medium leading-none tracking-tight">{value}</p>
            <p className="font-mono text-[9.5px] tracking-[0.14em] uppercase text-muted-foreground mt-1.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <div className="px-5 pb-5">
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted-foreground mb-2.5">
            Waiting for you · {incoming.length}
          </p>
          <div className="flex flex-col gap-3">
            {incoming.map((c) => (
              <div key={c.id} className="rounded-[20px] border border-hairline bg-surface p-4 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-[20px]" style={{ background: "hsl(var(--accent))" }} />
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-clay-soft flex items-center justify-center font-serif text-lg shrink-0">
                    {c.other.display_name[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{c.other.display_name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">@{c.other.handle}</p>
                  </div>
                </div>
                {c.requester_label && (
                  <div className="mt-2.5 p-2 rounded-[10px] bg-accent-soft">
                    <p className="font-serif italic text-[13px]">"{c.requester_label}" of you</p>
                  </div>
                )}
                <div className="mt-3.5 pt-3.5 border-t border-dashed border-hairline">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-2">
                    Describe your connection with 2 words
                  </p>
                  <div className="flex gap-1.5">
                    <Input
                      value={acceptWords[c.id]?.[0] ?? ""}
                      onChange={(e) => setAcceptWords((s) => ({ ...s, [c.id]: [e.target.value, s[c.id]?.[1] ?? ""] }))}
                      placeholder="Word 1"
                      className="flex-1 rounded-[10px]"
                    />
                    <Input
                      value={acceptWords[c.id]?.[1] ?? ""}
                      onChange={(e) => setAcceptWords((s) => ({ ...s, [c.id]: [s[c.id]?.[0] ?? "", e.target.value] }))}
                      placeholder="Word 2"
                      className="flex-1 rounded-[10px]"
                    />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => decline(c)} className="text-muted-foreground">
                      Skip
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => accept(c)}
                      disabled={!acceptWords[c.id]?.[0]?.trim() || !acceptWords[c.id]?.[1]?.trim()}
                      className="flex-1"
                    >
                      Accept connection
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite card */}
      <div className="px-5 pb-5">
        <div
          className="rounded-[20px] border border-hairline p-4"
          style={{ background: "linear-gradient(135deg, hsl(var(--accent-soft)) 0%, hsl(var(--surface)) 100%)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-serif text-[18px]">Invite a friend</p>
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                Single-use codes. They auto-connect with you.
              </p>
            </div>
            <button
              onClick={newCode}
              className="shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] bg-foreground text-background px-3 py-1.5 rounded-full"
            >
              + New
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {codes.length === 0 && (
              <p className="font-mono text-[11px] text-muted-foreground">No codes yet.</p>
            )}
            {codes.map((c) => (
              <div key={c.code} className="flex items-center gap-2 rounded-[10px] border border-hairline bg-surface px-3 py-2.5">
                <code className="flex-1 truncate font-mono text-[12px]">{c.code}</code>
                {c.used_by ? (
                  <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-signal-soft text-signal">
                    Used
                  </span>
                ) : (
                  <>
                    <button onClick={() => copy(inviteLink(c.code))} className="text-muted-foreground hover:text-foreground" aria-label="Copy link">
                      <Copy size={16} />
                    </button>
                    <button onClick={() => shareCode(c.code)} className="text-muted-foreground hover:text-foreground" aria-label="Share">
                      <Share size={16} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sign out */}
      <div className="px-5 pb-10">
        <Button
          onClick={signOut}
          variant="ghost"
          className="w-full font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
        >
          Sign out
        </Button>
      </div>
    </MobileShell>
  );
};

export default Me;
