import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  other: { id: string; handle: string; display_name: string };
  iAmRequester: boolean;
};

const Connections = () => {
  const { user } = useAuth();
  const [conns, setConns] = useState<Conn[]>([]);
  const [codes, setCodes] = useState<{ code: string; used_by: string | null }[]>([]);
  const [acceptLabel, setAcceptLabel] = useState<Record<string, string>>({});

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("connections")
      .select("*")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    const otherIds = (data ?? []).map((c: any) => (c.requester_id === user.id ? c.addressee_id : c.requester_id));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, handle, display_name")
      .in("id", otherIds.length ? otherIds : ["00000000-0000-0000-0000-000000000000"]);
    const pm = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    setConns(
      (data ?? []).map((c: any) => ({
        ...c,
        other: pm.get(c.requester_id === user.id ? c.addressee_id : c.requester_id) ?? { id: "?", handle: "?", display_name: "?" },
        iAmRequester: c.requester_id === user.id,
      }))
    );

    const { data: cd } = await supabase
      .from("invite_codes")
      .select("code, used_by")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });
    setCodes(cd ?? []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const newCode = async () => {
    if (!user) return;
    const code = generateInviteCode();
    const { error } = await supabase.from("invite_codes").insert({ code, created_by: user.id });
    if (error) toast.error(error.message);
    else {
      toast.success("Invite created");
      load();
    }
  };

  const inviteLink = (code: string) => `${window.location.origin}/auth?code=${encodeURIComponent(code)}`;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const share = async (code: string) => {
    const url = inviteLink(code);
    const text = `Join me on Friend of a Friend — code ${code}`;
    if ((navigator as any).share) {
      try { await (navigator as any).share({ title: "Friend of a Friend", text, url }); } catch {}
    } else {
      copy(url);
    }
  };

  const accept = async (c: Conn) => {
    const label = (acceptLabel[c.id] ?? "").trim();
    if (label.split(/\s+/).filter(Boolean).length !== 2) {
      toast.error("Use exactly 2 words (e.g. \"College Friend\")");
      return;
    }
    const { error } = await supabase
      .from("connections")
      .update({ status: "accepted", addressee_label: label })
      .eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success("Connected"); load(); }
  };
  const decline = async (c: Conn) => {
    const { error } = await supabase.from("connections").update({ status: "declined" }).eq("id", c.id);
    if (error) toast.error(error.message);
    else load();
  };

  const incoming = conns.filter((c) => !c.iAmRequester && c.status === "pending");
  const outgoing = conns.filter((c) => c.iAmRequester && c.status === "pending");
  const accepted = conns.filter((c) => c.status === "accepted");

  return (
    <MobileShell>
      <div className="container-mobile pt-6">
        <p className="label-mono text-muted-foreground">YOUR PEOPLE</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Connections</h1>

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
            {codes.length === 0 && (
              <p className="font-mono text-[11px] text-muted-foreground">No codes yet.</p>
            )}
            {codes.map((c) => (
              <div key={c.code} className="flex items-center gap-2 rounded-lg border border-hairline bg-background px-3 py-2">
                <code className="flex-1 truncate text-[12px]">{c.code}</code>
                {c.used_by ? (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">USED</span>
                ) : (
                  <>
                    <button onClick={() => copy(inviteLink(c.code))} className="text-muted-foreground hover:text-foreground" aria-label="Copy link">
                      <Copy className="h-4 w-4" />
                    </button>
                    <button onClick={() => share(c.code)} className="text-muted-foreground hover:text-foreground" aria-label="Share">
                      <Share2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Incoming */}
        {incoming.length > 0 && (
          <section className="mt-6">
            <p className="label-mono mb-2 text-muted-foreground">INCOMING</p>
            <div className="flex flex-col gap-2">
              {incoming.map((c) => (
                <div key={c.id} className="rounded-xl border border-hairline bg-surface p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{c.other.display_name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">@{c.other.handle} · they said: "{c.requester_label}"</p>
                    </div>
                  </div>
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

        {/* Outgoing */}
        {outgoing.length > 0 && (
          <section className="mt-6">
            <p className="label-mono mb-2 text-muted-foreground">PENDING</p>
            <div className="flex flex-col gap-2">
              {outgoing.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl border border-hairline bg-surface px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{c.other.display_name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">@{c.other.handle}</p>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">SENT</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Accepted */}
        <section className="mt-6">
          <p className="label-mono mb-2 text-muted-foreground">CONNECTED · {accepted.length}</p>
          {accepted.length === 0 && <p className="text-sm text-muted-foreground">No connections yet. Share an invite to grow your network.</p>}
          <div className="flex flex-col gap-2">
            {accepted.map((c) => (
              <Link to={`/u/${c.other.handle}`} key={c.id} className="flex items-center justify-between rounded-xl border border-hairline bg-surface px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{c.other.display_name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">@{c.other.handle}</p>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-signal">CONNECTED</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </MobileShell>
  );
};

export default Connections;
