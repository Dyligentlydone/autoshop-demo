-- Approval tokens table for customer estimate approvals
-- Allows customers to approve estimates via secure link sent via SMS

CREATE TABLE IF NOT EXISTS approval_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT UNIQUE NOT NULL,
  repair_order_id UUID NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Token metadata
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  is_used BOOLEAN DEFAULT FALSE,
  
  -- Viewed tracking
  first_viewed_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  
  -- Audit log on approval
  approved_ip TEXT,
  approved_user_agent TEXT,
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Metadata (optional - store estimate snapshot at time of token creation)
  metadata JSONB
);

-- Migration: add new columns if table already exists
ALTER TABLE approval_tokens ADD COLUMN IF NOT EXISTS first_viewed_at TIMESTAMPTZ;
ALTER TABLE approval_tokens ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE approval_tokens ADD COLUMN IF NOT EXISTS approved_ip TEXT;
ALTER TABLE approval_tokens ADD COLUMN IF NOT EXISTS approved_user_agent TEXT;

-- Snapshot at time of approval (frozen state for permanent record)
ALTER TABLE approval_tokens ADD COLUMN IF NOT EXISTS snapshot JSONB;
ALTER TABLE approval_tokens ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT;

-- Storage bucket for permanent approved estimate PDFs (private, signed URL access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('approved-estimates', 'approved-estimates', false)
ON CONFLICT (id) DO NOTHING;

-- Indexes
CREATE INDEX idx_approval_tokens_token ON approval_tokens(token);
CREATE INDEX idx_approval_tokens_repair_order_id ON approval_tokens(repair_order_id);
CREATE INDEX idx_approval_tokens_expires_at ON approval_tokens(expires_at);
CREATE INDEX idx_approval_tokens_is_used ON approval_tokens(is_used);

-- Enable RLS
ALTER TABLE approval_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all for service role
CREATE POLICY "Allow all for service role - approval_tokens" 
  ON approval_tokens 
  FOR ALL 
  USING (true);

-- Updated_at trigger
CREATE TRIGGER update_approval_tokens_updated_at 
  BEFORE UPDATE ON approval_tokens
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE approval_tokens IS 'Secure tokens for customer estimate approvals via SMS link';
COMMENT ON COLUMN approval_tokens.token IS 'Unique secure token (UUID or random string)';
COMMENT ON COLUMN approval_tokens.expires_at IS 'Token expiration timestamp (typically 7-30 days)';
COMMENT ON COLUMN approval_tokens.used_at IS 'When the customer clicked approve';
COMMENT ON COLUMN approval_tokens.metadata IS 'Optional snapshot of estimate data at token creation';
