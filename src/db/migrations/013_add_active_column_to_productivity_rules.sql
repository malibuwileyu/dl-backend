-- Add active column to productivity_rules table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'productivity_rules' AND column_name = 'active'
    ) THEN
        ALTER TABLE productivity_rules ADD COLUMN active BOOLEAN DEFAULT true;
    END IF;
END $$;