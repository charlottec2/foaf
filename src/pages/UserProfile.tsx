import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mutualCount } from "@/lib/graph";
import { emitNetworkExpansion } from "@/lib/events";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";

const UserProfile = () => {
  const { handle } = useParams<{ handle: string }>();
  const { user } = useAuth();
  const nav = useNavigate();
  const [target, setTarget] = useState<{ id: string; handle: string; display_name: string; bio: string | null } | null>(null);
  const [mutuals, setMutuals] = useState<number>(0);
  const [conn, setConn] = useState<any | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!handle || !user) return;
    const { data: p } = await supabase
      .from("profiles")
      .select("id, handle, display_name, bio")
      .eq("handle", handle)
      .maybeSingle();
    if (!p) {
      toast.error("Profile not found");
      return;
    }
    setTarget(p as any);
    const m = await mutualCount(user.id, (p as any).id);
    setMutuals(m);
    const { data: c } = await supabase
      .from("connections")
      .select("*")
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${(p as any).id}),and(requester_id.eq.${(p as any).id},addressee_id.eq.${user.id})`
      )
      .maybeSingle();
    setConn(c);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [handle, user?.id]);

  const sendRequest = async () => {
    if (!user || !target) return;
    if (label.trim().split(/\s+/).filter(Boolean).length !== 2) {
      toast.error("Use exactly 2 words (e.g. \"Gym Buddy\")");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("connections").insert({
      requester_id: user.id,
      addressee_id: target.id,
      requester_label: label.trim(),
      status: "pending",
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Request sent"); load(); }
  };

  if (!target) {
    return (
      <MobileShell hideNav>
        <div className="container-mobile pt-10 font-mono text-xs text-muted-foreground">Loading…</div>
      </MobileShell>
    );
  }

  const isMe = target.id === user?.id;

  return (
    <MobileShell hideNav>
      <div className="container-mobile pt-6">
        <button onClick={() => nav(-1)} className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>

        <div className="mt-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-2 text-2xl font-bold">
            {target.display_name.slice(0, 1).toUpperCase()}
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">{target.display_name}</h1>
          <p className="font-mono text-[12px] text-muted-foreground">@{target.handle}</p>
          {target.bio && <p className="mt-3 text-sm text-muted-foreground">{target.bio}</p>}
        </div>

        {!isMe && (
          <div className="mt-5 rounded-xl border border-hairline bg-surface p-4">
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {mutuals} mutual connection{mutuals === 1 ? "" : "s"}
            </p>

            {!conn && (
              <div className="mt-3">
                <Label htmlFor="lbl" className="label-mono text-muted-foreground">How do you know them? (2 words)</Label>
                <div className="mt-1.5 flex gap-2">
                  <Input id="lbl" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="College Friend" />
                  <Button onClick={sendRequest} disabled={busy}>Connect</Button>
                </div>
              </div>
            )}
            {conn?.status === "pending" && (
              <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">REQUEST PENDING</p>
            )}
            {conn?.status === "accepted" && (
              <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-signal">CONNECTED</p>
            )}
          </div>
        )}

        <Link to="/connections" className="mt-6 inline-block font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          ← Back to connections
        </Link>
      </div>
    </MobileShell>
  );
};

export default UserProfile;
