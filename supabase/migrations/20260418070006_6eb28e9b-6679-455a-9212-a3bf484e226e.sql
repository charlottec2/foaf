DROP VIEW IF EXISTS public.accepted_edges;
CREATE VIEW public.accepted_edges WITH (security_invoker = true) AS
  SELECT requester_id AS a, addressee_id AS b FROM public.connections WHERE status='accepted'
  UNION
  SELECT addressee_id AS a, requester_id AS b FROM public.connections WHERE status='accepted';