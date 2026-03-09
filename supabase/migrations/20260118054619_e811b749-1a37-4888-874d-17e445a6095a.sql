-- Create calls table for video calls
CREATE TABLE public.calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caller_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  room_url TEXT NOT NULL,
  room_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- Create policies for calls
CREATE POLICY "Users can view their own calls" 
ON public.calls 
FOR SELECT 
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create calls" 
ON public.calls 
FOR INSERT 
WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Users can update their own calls" 
ON public.calls 
FOR UPDATE 
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- Create index for faster lookups
CREATE INDEX idx_calls_caller_id ON public.calls(caller_id);
CREATE INDEX idx_calls_receiver_id ON public.calls(receiver_id);
CREATE INDEX idx_calls_status ON public.calls(status);

-- Enable realtime for calls (for incoming call notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;