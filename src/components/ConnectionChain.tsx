import { Fragment } from "react";
import { cn } from "@/lib/utils";

export type ChainNode = {
  id: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  label?: string;
};

type Props = {
  nodes: ChainNode[];
  loading?: boolean;
};

export const ConnectionChain = ({ nodes, loading }: Props) => {
  return (
    <div className="mx-5 mb-5 rounded-[24px] border border-hairline bg-surface" style={{ padding: "18px 18px 20px" }}>
      <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted-foreground mb-3">
        Your longest chain this week
      </p>

      {loading && (
        <p className="font-mono text-[11px] text-muted-foreground">Loading…</p>
      )}

      {!loading && nodes.length === 0 && (
        <p className="font-serif italic text-sm text-muted-foreground">
          Your chain will appear here once you connect with someone new.
        </p>
      )}

      {!loading && nodes.length > 0 && (
        <div className="flex items-start">
          {nodes.map((node, i) => (
            <Fragment key={node.id}>
              <div className="flex flex-col items-center gap-1.5" style={{ maxWidth: 64 }}>
                <div
                  className={cn("w-12 h-12 rounded-full overflow-hidden bg-clay-soft flex items-center justify-center")}
                  style={
                    i === 0 || i === nodes.length - 1
                      ? { boxShadow: "0 0 0 1.5px hsl(var(--accent)), 0 0 0 4px hsl(var(--background))" }
                      : undefined
                  }
                >
                  {node.avatar_url ? (
                    <img src={node.avatar_url} alt={node.display_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-serif text-lg text-foreground">
                      {node.display_name[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-semibold text-center leading-tight truncate w-full text-center">
                  {node.display_name.split(" ")[0]}
                </p>
                {node.label && (
                  <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground text-center leading-tight">
                    {node.label}
                  </p>
                )}
              </div>

              {i < nodes.length - 1 && (
                <div className="flex-1 flex items-center justify-center" style={{ marginTop: 22, minWidth: 8 }}>
                  <svg width="100%" height="10" className="overflow-visible">
                    <line
                      x1="0" y1="5" x2="100%" y2="5"
                      stroke="hsl(var(--accent))"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                  </svg>
                </div>
              )}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
