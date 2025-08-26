/*
  # Add isActive and endDate fields to campaigns

  1. New Columns
    - `is_active` (boolean, default true) - Controls whether campaign is currently active
    - `end_date` (timestamp with time zone, nullable) - Campaign end date and time

  2. Indexes
    - Add index on `is_active` for efficient filtering
    - Add index on `end_date` for date-based queries
    - Add composite index on `is_active` and `end_date` for combined filtering

  3. Notes
    - Existing campaigns will have `is_active` set to `true` by default
    - `end_date` will be `null` for existing campaigns (no end date)
    - These changes are backward compatible
*/

-- Add is_active column with default value of true
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.campaigns ADD COLUMN is_active BOOLEAN DEFAULT TRUE NOT NULL;
  END IF;
END $$;

-- Add end_date column (nullable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE public.campaigns ADD COLUMN end_date TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_campaigns_is_active 
ON public.campaigns USING btree (is_active);

CREATE INDEX IF NOT EXISTS idx_campaigns_end_date 
ON public.campaigns USING btree (end_date);

-- Add composite index for filtering active campaigns by end date
CREATE INDEX IF NOT EXISTS idx_campaigns_active_end_date 
ON public.campaigns USING btree (is_active, end_date) 
WHERE is_active = true;