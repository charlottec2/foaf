import { Link } from "react-router-dom";
import { Calendar, MapPin, Users } from "lucide-react";
import { ConnectionPath } from "./ConnectionPath";

export type FeedInitiative = {
  id: string;
  title: string;
  description: string | null;
  category: "social" | "professional" | "events";
  starts_at: string;
  location: string | null;
  size_cap: number;
  host: { id: string; display_name: string; handle: string };
  pathNodes: { id: string; display_name: string; handle: string }[];
  attendeeCount: number;
  unlockedReason?: string | null;
};

const fmtDate = (s: string) => {
  const d = new Date(s);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const categoryLabel = {
  social: "SOCIAL",
  professional: "PRO",
  events: "EVENT",
};

export const InitiativeCard = ({ it }: { it: FeedInitiative }) => {
  return (
    <Link
      to={`/i/${it.id}`}
      className="group block overflow-hidden rounded-2xl border border-hairline bg-surface transition active:scale-[0.99]"
    >
      <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
        <span className="label-mono text-muted-foreground">{categoryLabel[it.category]}</span>
        <span className="font-mono text-[11px] text-muted-foreground">@{it.host.handle}</span>
      </div>
      <div className="px-4 py-4">
        <h3 className="text-[20px] font-semibold leading-tight tracking-tight">{it.title}</h3>
        {it.description && (
          <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{it.description}</p>
        )}

        <div className="mt-4 flex flex-col gap-1.5 font-mono text-[12px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            <span>{fmtDate(it.starts_at)}</span>
          </div>
          {it.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate">{it.location}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5" />
            <span>
              {it.attendeeCount}/{it.size_cap} going
            </span>
          </div>
        </div>

        <div className="mt-4 border-t border-hairline pt-3">
          <ConnectionPath nodes={it.pathNodes} />
          {it.unlockedReason && (
            <p className="mt-2 font-mono text-[11px] text-signal">↑ {it.unlockedReason}</p>
          )}
        </div>
      </div>
    </Link>
  );
};
