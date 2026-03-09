-- Create node_positions table for storing drag positions separately
CREATE TABLE public.node_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.family_tree_members(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  y DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(member_id)
);

-- Enable RLS
ALTER TABLE public.node_positions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view all node positions"
ON public.node_positions FOR SELECT
USING (true);

CREATE POLICY "Owners can insert node positions"
ON public.node_positions FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update node positions"
ON public.node_positions FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete node positions"
ON public.node_positions FOR DELETE
USING (auth.uid() = owner_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.node_positions;