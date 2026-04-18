import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
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

const NewInitiative = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Cat>("social");
  const [startsAt, setStartsAt] = useState("");
  const [location, setLocation] = useState("");
  const [sizeCap, setSizeCap] = useState(8);
  const [minMutuals, setMinMutuals] = useState(1);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("initiatives")
      .insert({
        host_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        category,
        starts_at: new Date(startsAt).toISOString(),
        location: location.trim() || null,
        size_cap: sizeCap,
        min_mutuals: minMutuals,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) toast.error(error.message);
    else if (data) {
      toast.success("Initiative posted");
      nav(`/i/${data.id}`, { replace: true });
    }
  };

  return (
    <MobileShell hideNav>
      <div className="container-mobile pt-6">
        <Link to="/" className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">New initiative</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visible only to people who share enough mutual connections with you.
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
          <Button type="submit" disabled={busy} className="mt-4 h-12">{busy ? "…" : "Post initiative"}</Button>
        </form>
      </div>
    </MobileShell>
  );
};

export default NewInitiative;
