import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Mode = "social" | "professional" | "events";

const Auth = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const initialCode = params.get("code") ?? "";
  const initialTab = params.get("tab") === "login" ? "login" : "signup";

  const [tab, setTab] = useState<"signup" | "login">(initialTab);
  const [loading, setLoading] = useState(false);

  // signup state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState(initialCode);
  const [mode, setMode] = useState<Mode>("social");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) nav("/", { replace: true });
    });
  }, [nav]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const trimmed = code.trim().toUpperCase();
      if (!trimmed) {
        toast.error("Invite code required");
        setLoading(false);
        return;
      }
      // Validate invite code (publicly readable per RLS)
      const { data: inv } = await supabase
        .from("invite_codes")
        .select("code, used_by")
        .eq("code", trimmed)
        .maybeSingle();
      if (!inv || inv.used_by) {
        toast.error("Invite code is invalid or already used");
        setLoading(false);
        return;
      }

      const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (cleanHandle.length < 2) {
        toast.error("Handle must be at least 2 characters (a-z, 0-9, _)");
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            handle: cleanHandle,
            display_name: displayName.trim() || cleanHandle,
            mode,
            invite_code: trimmed,
          },
        },
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Welcome in");
        nav("/", { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
    else nav("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container-mobile flex min-h-screen flex-col py-10">
        <header className="mb-8">
          <p className="label-mono text-muted-foreground">FRIEND OF A FRIEND</p>
          <h1 className="mt-3 text-[34px] font-bold leading-[1.05] tracking-tight">
            Initiatives,<br />only with people<br />in your network.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Invite-only. You see what your friends — and their friends — are doing.
          </p>
        </header>

        <div className="mb-5 inline-flex self-start rounded-full border border-hairline p-1 font-mono text-[11px] uppercase tracking-[0.14em]">
          <button
            onClick={() => setTab("signup")}
            className={`rounded-full px-4 py-1.5 ${tab === "signup" ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            Join
          </button>
          <button
            onClick={() => setTab("login")}
            className={`rounded-full px-4 py-1.5 ${tab === "login" ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            Sign in
          </button>
        </div>

        {tab === "signup" ? (
          <form onSubmit={handleSignup} className="flex flex-col gap-3">
            <div>
              <Label htmlFor="code" className="label-mono text-muted-foreground">Invite code</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="FOAF-XXXX-XXXX"
                className="mt-1.5 font-mono tracking-wider"
                autoCapitalize="characters"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="handle" className="label-mono text-muted-foreground">Handle</Label>
                <Input id="handle" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="alex" className="mt-1.5" required />
              </div>
              <div>
                <Label htmlFor="name" className="label-mono text-muted-foreground">Name</Label>
                <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Alex M." className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label htmlFor="email" className="label-mono text-muted-foreground">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" required />
            </div>
            <div>
              <Label htmlFor="password" className="label-mono text-muted-foreground">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" required minLength={8} />
            </div>
            <div>
              <Label className="label-mono text-muted-foreground">Mode</Label>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {(["social", "professional", "events"] as Mode[]).map((m) => (
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
            <Button type="submit" disabled={loading} className="mt-4 h-12 text-base">
              {loading ? "…" : "Join"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              No code? Ask a friend already in to share theirs.
            </p>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <div>
              <Label htmlFor="lemail" className="label-mono text-muted-foreground">Email</Label>
              <Input id="lemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" required />
            </div>
            <div>
              <Label htmlFor="lpassword" className="label-mono text-muted-foreground">Password</Label>
              <Input id="lpassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" required />
            </div>
            <Button type="submit" disabled={loading} className="mt-4 h-12 text-base">
              {loading ? "…" : "Sign in"}
            </Button>
          </form>
        )}

        <div className="mt-auto pt-10 text-center">
          <Link to="/" className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            ← back
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Auth;
