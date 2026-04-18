import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const Me = () => {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [mode, setMode] = useState<"social" | "professional" | "events">("social");
  const [stats, setStats] = useState({ connections: 0, hosting: 0, joined: 0 });

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name);
      setBio(profile.bio ?? "");
      setMode(profile.mode);
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ count: c1 }, { count: c2 }, { count: c3 }] = await Promise.all([
        supabase.from("connections").select("id", { count: "exact", head: true })
          .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`).eq("status", "accepted"),
        supabase.from("initiatives").select("id", { count: "exact", head: true }).eq("host_id", user.id),
        supabase.from("initiative_members").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "approved"),
      ]);
      setStats({ connections: c1 ?? 0, hosting: c2 ?? 0, joined: c3 ?? 0 });
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim(), bio: bio.trim() || null, mode })
      .eq("id", user.id);
    if (error) toast.error(error.message);
    else { toast.success("Saved"); refreshProfile(); }
  };

  return (
    <MobileShell>
      <div className="container-mobile pt-6">
        <p className="label-mono text-muted-foreground">YOU</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{profile?.display_name}</h1>
        <p className="font-mono text-[12px] text-muted-foreground">@{profile?.handle}</p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            ["Connections", stats.connections],
            ["Hosting", stats.hosting],
            ["Going to", stats.joined],
          ].map(([label, n]) => (
            <div key={label as string} className="rounded-xl border border-hairline bg-surface px-3 py-3 text-center">
              <p className="text-xl font-bold">{n}</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        <section className="mt-6 flex flex-col gap-3">
          <div>
            <Label htmlFor="dn" className="label-mono text-muted-foreground">Display name</Label>
            <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="bio" className="label-mono text-muted-foreground">Bio</Label>
            <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="mt-1.5" />
          </div>
          <div>
            <Label className="label-mono text-muted-foreground">Mode</Label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {(["social", "professional", "events"] as const).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-lg border px-3 py-2 text-xs uppercase tracking-wider font-mono ${mode === m ? "border-foreground bg-foreground text-background" : "border-hairline text-muted-foreground"}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={save} className="mt-3 h-12">Save</Button>
          <Button onClick={signOut} variant="ghost" className="text-muted-foreground">Sign out</Button>
        </section>
      </div>
    </MobileShell>
  );
};

export default Me;
