-- Add views_count column to posts table
ALTER TABLE posts ADD COLUMN views_count INTEGER DEFAULT 0;

-- Create function to increment post views
CREATE OR REPLACE FUNCTION increment_post_views(post_id UUID)
RETURNS INTEGER AS $$
DECLARE
    new_count INTEGER;
BEGIN
    -- Increment the views count and return the new value
    UPDATE posts 
    SET views_count = COALESCE(views_count, 0) + 1
    WHERE id = post_id
    RETURNING views_count INTO new_count;
    
    RETURN new_count;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_post_views TO authenticated;
GRANT EXECUTE ON FUNCTION increment_post_views TO service_role;
