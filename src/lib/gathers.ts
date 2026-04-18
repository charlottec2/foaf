import { supabase } from "@/integrations/supabase/client";
import { shortestPath } from "./graph";

export type EnrichedGather = {
  id: string;
  title: string;
  description: string | null;
  category: "social" | "professional" | "events";
  starts_at: string;
  location: string | null;
  size_cap: number;
  source_group_id: string | null;
  host: { id: string; display_name: string; handle: string };
  pathNodes: { id: string; display_name: string; handle: string }[];
  attendeeCount: number;
};

// Loads a list of gathers and enriches each with host profile, member count, and shortest connection path.
export const loadEnrichedGathers = async (
  viewerId: string,
  filter?: { upcomingOnly?: boolean; excludeMine?: boolean }
): Promise<EnrichedGather[]> => {
  let q = supabase
    .from("gathers")
    .select("id, title, description, category, starts_at, location, size_cap, host_id, source_group_id")
    .order("starts_at", { ascending: true });
  if (filter?.upcomingOnly) q = q.gte("starts_at", new Date().toISOString());
  const { data: gs } = await q;
  if (!gs) return [];
  let rows = gs;
  if (filter?.excludeMine) rows = rows.filter((r: any) => r.host_id !== viewerId);

  if (rows.length === 0) return [];

  const hostIds = Array.from(new Set(rows.map((r: any) => r.host_id)));
  const { data: hosts } = await supabase
    .from("profiles")
    .select("id, handle, display_name")
    .in("id", hostIds);
  const hostMap = new Map((hosts ?? []).map((h: any) => [h.id, h]));

  const { data: members } = await supabase
    .from("gather_members")
    .select("gather_id, status")
    .in("gather_id", rows.map((r: any) => r.id));
  const counts = new Map<string, number>();
  (members ?? []).forEach((m: any) => {
    if (m.status === "approved") counts.set(m.gather_id, (counts.get(m.gather_id) ?? 0) + 1);
  });

  return Promise.all(
    rows.map(async (r: any) => {
      let pathIds: string[] = [viewerId, r.host_id];
      if (r.host_id !== viewerId) {
        pathIds = (await shortestPath(viewerId, r.host_id, 4)) ?? [viewerId, r.host_id];
      }
      const { data: pathProfiles } = await supabase
        .from("profiles")
        .select("id, handle, display_name")
        .in("id", pathIds);
      const pmap = new Map((pathProfiles ?? []).map((p: any) => [p.id, p]));
      const pathNodes = pathIds.map(
        (id) => pmap.get(id) ?? { id, handle: "?", display_name: "someone" }
      );
      const host = hostMap.get(r.host_id) ?? { id: r.host_id, handle: "?", display_name: "Host" };
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        category: r.category,
        starts_at: r.starts_at,
        location: r.location,
        size_cap: r.size_cap,
        source_group_id: r.source_group_id,
        host: host as any,
        pathNodes: pathNodes as any,
        attendeeCount: counts.get(r.id) ?? 0,
      };
    })
  );
};
