-- Create family_networks table to group users into family networks (like Telegram groups)
CREATE TABLE public.family_networks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add family_network_id to profiles to track which network a user belongs to
ALTER TABLE public.profiles ADD COLUMN family_network_id UUID REFERENCES public.family_networks(id);

-- Enable RLS for family_networks
ALTER TABLE public.family_networks ENABLE ROW LEVEL SECURITY;

-- Anyone can view networks (needed for fetching family members)
CREATE POLICY "Users can view family networks" ON public.family_networks
FOR SELECT USING (true);

-- Authenticated users can create networks
CREATE POLICY "Authenticated users can create family networks" ON public.family_networks
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow realtime for family_tree_members
ALTER PUBLICATION supabase_realtime ADD TABLE public.family_tree_members;