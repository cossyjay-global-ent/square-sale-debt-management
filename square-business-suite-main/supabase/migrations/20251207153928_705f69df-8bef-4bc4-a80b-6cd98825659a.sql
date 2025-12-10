-- Add profit_margin_goal to user_settings
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS profit_margin_goal numeric DEFAULT 20;

-- Add comment
COMMENT ON COLUMN public.user_settings.profit_margin_goal IS 'Target profit margin percentage for alerts';