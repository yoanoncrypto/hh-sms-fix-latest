/*
  # Admin Settings Schema

  1. New Table
    - `admin_settings` - Stores global administrative settings
      - `id` (int, primary key) - Always 1 to ensure single row
      - `phone_number` (text, nullable) - Global administrative phone number in E.164 format
      - `created_at` (timestamptz, not null, default now())
      - `updated_at` (timestamptz, not null, default now())

  2. Security
    - Enable RLS on `admin_settings` table
    - Add policy for authenticated users to manage admin settings

  3. Constraints
    - Ensure only one row can exist (id=1)
    - Phone number must be valid E.164 format if provided
*/

-- Create the admin_settings table
CREATE TABLE IF NOT EXISTS public.admin_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    phone_number TEXT CHECK (phone_number IS NULL OR phone_number ~ '^\+\d{10,15}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on admin_settings table
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for admin_settings table
CREATE POLICY "Enable full access for authenticated users on admin_settings"
ON public.admin_settings
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role full access on admin_settings"
ON public.admin_settings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_admin_settings_updated_at
    BEFORE UPDATE ON public.admin_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert initial row with default values
INSERT INTO public.admin_settings (id, phone_number) 
VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_admin_settings_id ON public.admin_settings(id);
