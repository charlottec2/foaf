import { ChevronRight } from "lucide-react";

type Node = { id: string; display_name: string; handle: string };

export const ConnectionPath = ({
  nodes,
  prefix = "VIA",
}: {
  nodes: Node[];
  prefix?: string;
}) => {
  if (!nodes || nodes.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
      <span className="label-mono text-muted-foreground">{prefix}</span>
      {nodes.map((n, i) => (
        <span key={n.id} className="flex items-center gap-1.5">
          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-foreground">
            {i === 0 ? "you" : n.display_name}
          </span>
          {i < nodes.length - 1 && <ChevronRight className="h-3 w-3 opacity-50" />}
        </span>
      ))}
    </div>
  );
};
