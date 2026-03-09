-- Family tree members table (stores both real users and placeholder profiles)
CREATE TABLE public.family_tree_members (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID NOT NULL,
    linked_user_id UUID DEFAULT NULL,
    member_name TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    avatar_url TEXT,
    gender TEXT CHECK (gender IN ('male', 'female')),
    is_placeholder BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.family_tree_members ENABLE ROW LEVEL SECURITY;

-- Family invitations table
CREATE TABLE public.family_invitations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    member_id UUID NOT NULL REFERENCES public.family_tree_members(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.family_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for family_tree_members
CREATE POLICY "Users can view all family members" 
ON public.family_tree_members 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own family members" 
ON public.family_tree_members 
FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners and linked users can update family members" 
ON public.family_tree_members 
FOR UPDATE 
USING (auth.uid() = owner_id OR auth.uid() = linked_user_id);

CREATE POLICY "Owners can delete family members" 
ON public.family_tree_members 
FOR DELETE 
USING (auth.uid() = owner_id);

-- RLS Policies for family_invitations
CREATE POLICY "Users can view their invitations" 
ON public.family_invitations 
FOR SELECT 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create invitations" 
ON public.family_invitations 
FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Receivers can update invitation status" 
ON public.family_invitations 
FOR UPDATE 
USING (auth.uid() = receiver_id);

CREATE POLICY "Senders can delete invitations" 
ON public.family_invitations 
FOR DELETE 
USING (auth.uid() = sender_id);

-- Enable realtime for invitations
ALTER PUBLICATION supabase_realtime ADD TABLE public.family_invitations;