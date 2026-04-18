import { supabase } from "@/integrations/supabase/client";

// Returns the user IDs the given user has accepted connections with.
export const getDirectConnections = async (userId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from("connections")
    .select("requester_id, addressee_id, status")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq("status", "accepted");
  if (error || !data) return [];
  return data.map((c: any) => (c.requester_id === userId ? c.addressee_id : c.requester_id));
};

// Compute shortest path from viewer to host using BFS, hop-limited.
// Returns an array of profile IDs from viewer to host inclusive, or null.
export const shortestPath = async (
  viewerId: string,
  hostId: string,
  maxHops = 4
): Promise<string[] | null> => {
  if (viewerId === hostId) return [viewerId];

  const visited = new Map<string, string | null>();
  visited.set(viewerId, null);
  let frontier: string[] = [viewerId];

  for (let depth = 0; depth < maxHops; depth++) {
    if (frontier.length === 0) break;
    // Fetch edges out of all frontier nodes in one query
    const { data } = await supabase
      .from("connections")
      .select("requester_id, addressee_id")
      .eq("status", "accepted")
      .or(
        frontier
          .map((id) => `requester_id.eq.${id},addressee_id.eq.${id}`)
          .join(",")
      );
    const next: string[] = [];
    for (const row of (data ?? []) as any[]) {
      for (const [a, b] of [
        [row.requester_id, row.addressee_id],
        [row.addressee_id, row.requester_id],
      ]) {
        if (!frontier.includes(a)) continue;
        if (visited.has(b)) continue;
        visited.set(b, a);
        if (b === hostId) {
          // Reconstruct
          const path = [b];
          let cur: string | null = a;
          while (cur) {
            path.unshift(cur);
            cur = visited.get(cur) ?? null;
          }
          return path;
        }
        next.push(b);
      }
    }
    frontier = next;
  }
  return null;
};

// Count mutuals between two users (client-side; mirrors SQL helper)
export const mutualCount = async (u1: string, u2: string): Promise<number> => {
  const [a, b] = await Promise.all([getDirectConnections(u1), getDirectConnections(u2)]);
  const sb = new Set(b);
  return a.filter((x) => sb.has(x)).length;
};
