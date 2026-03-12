-- Create the family_invites table
CREATE TABLE IF NOT EXISTS public.family_invites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
    invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tree_node_id TEXT NOT NULL, -- using text as member id might be string or uuid depending on implementation
    relation_type TEXT, -- e.g., 'parent', 'child', 'spouse' (optional, can be null if just sharing the node)
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.family_invites ENABLE ROW LEVEL SECURITY;

-- Policies

-- 1. Users can view invites they created
CREATE POLICY "Users can view their own invites"
    ON public.family_invites
    FOR SELECT
    USING (auth.uid() = invited_by);

-- 2. Users can create invites
CREATE POLICY "Users can create invites"
    ON public.family_invites
    FOR INSERT
    WITH CHECK (auth.uid() = invited_by);

-- 3. Users can update their own invites (e.g. to cancel)
CREATE POLICY "Users can update their own invites"
    ON public.family_invites
    FOR UPDATE
    USING (auth.uid() = invited_by);

-- 4. Anyone can view an invite by token (needed for the invite acceptance page)
CREATE POLICY "Anyone can view invite by token"
    ON public.family_invites
    FOR SELECT
    USING (true);

-- 5. Authenticated users can update an invite status (e.g. to accept)
CREATE POLICY "Authenticated users can update invite status"
    ON public.family_invites
    FOR UPDATE
    USING (auth.role() = 'authenticated');
