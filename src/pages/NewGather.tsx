import { useEffect, useRef, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/MobileShell";
import { toast } from "sonner";
import { ArrowLeft, X, CalendarBlank, MapPin, UsersThree, ShieldCheck, ArrowRight } from "@phosphor-icons/react";

const Stepper = ({
  value,
  onChange,
  min = 0,
  max = 200,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) => (
  <div className="flex items-center gap-3">
    <button
      type="button"
      onClick={() => onChange(Math.max(min, value - 1))}
      className="w-8 h-8 rounded-full border border-hairline bg-surface flex items-center justify-center font-mono text-lg text-muted-foreground hover:border-foreground transition-colors"
    >
      −
    </button>
    <span className="font-serif text-[22px] font-medium w-8 text-center leading-none">{value}</span>
    <button
      type="button"
      onClick={() => onChange(Math.min(max, value + 1))}
      className="w-8 h-8 rounded-full border border-hairline bg-surface flex items-center justify-center font-mono text-lg text-muted-foreground hover:border-foreground transition-colors"
    >
      +
    </button>
  </div>
);

const NewGather = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const fromGroupId = params.get("fromGroup");
  const tagInputRef = useRef<HTMLInputElement>(null);

  const [groupName, setGroupName] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
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

  const addTag = () => {
    const val = tagInput.trim().replace(/,+$/, "").toLowerCase();
    if (val && !tags.includes(val) && tags.length < 10) {
      setTags((t) => [...t, val]);
      setTagInput("");
    } else {
      setTagInput("");
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags((t) => t.slice(0, -1));
    }
  };

  const removeTag = (tag: string) => setTags((t) => t.filter((x) => x !== tag));

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
        category: "social" as any,
        tags,
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

    if (fromGroupId) {
      const { data: members } = await supabase
        .from("group_members").select("user_id")
        .eq("group_id", fromGroupId).eq("status", "member");
      const rows = (members ?? []).map((m: any) => ({
        gather_id: newId, user_id: m.user_id, status: "approved" as const,
      }));
      if (!rows.find((r) => r.user_id === user.id)) {
        rows.push({ gather_id: newId, user_id: user.id, status: "approved" as const });
      }
      if (rows.length) {
        await supabase.from("gather_members").upsert(rows, { onConflict: "gather_id,user_id" });
      }
    }

    setBusy(false);
    toast.success("Function posted");
    nav(`/g/${newId}`, { replace: true });
  };

  return (
    <MobileShell hideNav>
      <div className="container-mobile pt-6 pb-10">

        {/* Back */}
        <Link
          to={fromGroupId ? `/groups/${fromGroupId}` : "/gather"}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
        >
          <ArrowLeft size={14} weight="bold" /> Back
        </Link>

        {/* Header */}
        <h1 className="mt-4 font-serif text-[26px] font-medium leading-tight">Create Function</h1>
        <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
          {groupName ? (
            <>From <span className="text-foreground font-medium">{groupName}</span> · group members auto-approved</>
          ) : (
            <>Visible only to people in your extended network</>
          )}
        </p>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-5">

          {/* Title — editorial serif input */}
          <div>
            <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-muted-foreground mb-2">Title</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Sunday Run & Brunch!"
              className="font-serif text-[22px] font-medium w-full bg-transparent outline-none placeholder:text-muted-foreground border-b-2 border-dashed pb-2 leading-tight"
              style={{ borderColor: "hsl(var(--accent))" }}
            />
          </div>

          {/* Description */}
          <div>
            <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-muted-foreground mb-2">Description</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What's the vibe?"
              className="font-serif italic text-[15px] leading-[1.5] w-full bg-transparent outline-none placeholder:text-muted-foreground border-b border-dashed resize-none pb-2"
              style={{ borderColor: "hsl(var(--hairline))" }}
            />
          </div>

          {/* Tags */}
          <div>
            <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-muted-foreground mb-2">
              Tags
              <span className="ml-2 text-muted-foreground/60">{tags.length}/10</span>
            </p>
            <div
              className="rounded-[16px] border border-hairline bg-surface p-3 flex flex-wrap gap-2 cursor-text"
              onClick={() => tagInputRef.current?.focus()}
            >
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.1em] px-2.5 py-1 rounded-full"
                  style={{ background: "hsl(var(--accent-soft))", color: "hsl(var(--foreground))" }}
                >
                  {tag}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                    className="opacity-50 hover:opacity-100 transition-opacity"
                    aria-label={`Remove ${tag}`}
                  >
                    <X size={10} weight="bold" />
                  </button>
                </span>
              ))}
              {tags.length < 10 && (
                <input
                  ref={tagInputRef}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={addTag}
                  placeholder={tags.length === 0 ? "Add a tag, press enter…" : ""}
                  className="font-mono text-[11px] bg-transparent outline-none placeholder:text-muted-foreground flex-1 min-w-[120px]"
                />
              )}
            </div>
          </div>

          {/* When & Where */}
          <div className="rounded-[20px] border border-hairline bg-surface p-4 flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <CalendarBlank size={13} className="text-muted-foreground" />
                <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-muted-foreground">Date & time</p>
              </div>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
                className="font-mono text-[13px] bg-transparent outline-none w-full text-foreground"
              />
            </div>
            <div className="border-t border-dashed border-hairline pt-4">
              <div className="flex items-center gap-1.5 mb-2">
                <MapPin size={13} className="text-muted-foreground" />
                <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-muted-foreground">Location</p>
              </div>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="King's Circle, Toronto..."
                className="font-mono text-[13px] bg-transparent outline-none w-full placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Gate settings */}
          <div className="rounded-[20px] border border-hairline bg-surface p-4 flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <UsersThree size={13} className="text-muted-foreground" />
                <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-muted-foreground">Capacity</p>
              </div>
              <Stepper value={sizeCap} onChange={setSizeCap} min={1} max={200} />
            </div>
            <div className="border-t border-dashed border-hairline pt-4">
              <div className="flex items-center gap-1.5 mb-3">
                <ShieldCheck size={13} className="text-muted-foreground" />
                <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-muted-foreground">Min mutuals</p>
              </div>
              <Stepper value={minMutuals} onChange={setMinMutuals} min={0} max={10} />
              <p className="mt-3 font-mono text-[10px] text-muted-foreground leading-relaxed">
                {minMutuals === 0
                  ? "Anyone in your extended graph can see this gather."
                  : `Only people with ${minMutuals}+ mutual connection${minMutuals > 1 ? "s" : ""} with you can see this post.`}
              </p>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={busy}
            className="mt-1 w-full inline-flex items-center justify-center gap-2 font-mono text-[12px] uppercase tracking-[0.14em] bg-foreground text-background py-4 rounded-full disabled:opacity-50 transition-opacity"
          >
            {busy ? "Posting…" : <>Post Function <ArrowRight size={13} weight="bold" /></>}
          </button>

        </form>
      </div>
    </MobileShell>
  );
};

export default NewGather;
