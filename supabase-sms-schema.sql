-- SMS Messages Schema
-- Run this in your Supabase SQL editor

-- SMS messages table
CREATE TABLE IF NOT EXISTS sms_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repair_order_id UUID REFERENCES repair_orders(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  message_body TEXT NOT NULL,
  message_type TEXT CHECK (message_type IN ('estimate', 'update', 'general', 'reply')),
  twilio_sid TEXT UNIQUE,
  status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SMS templates table
CREATE TABLE IF NOT EXISTS sms_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  template_type TEXT NOT NULL,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sms_messages_customer_id ON sms_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_repair_order_id ON sms_messages(repair_order_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_created_at ON sms_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_messages_direction ON sms_messages(direction);
CREATE INDEX IF NOT EXISTS idx_sms_messages_twilio_sid ON sms_messages(twilio_sid);

-- Insert default estimate template
INSERT INTO sms_templates (name, template_type, content, variables) VALUES
(
  'Estimate Ready',
  'estimate',
  'Hi {customerName}!

Your {serviceType} estimate is ready:

💰 Estimated Total: ${estimatedTotal}
📅 Est. Completion: {estimatedCompletion}

{photoCount} photo(s) attached

Questions? Reply to this message or call us!

- ACME TIRE',
  '{"customerName": "string", "serviceType": "string", "estimatedTotal": "number", "estimatedCompletion": "string", "photoCount": "number"}'::jsonb
)
ON CONFLICT DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for sms_messages
DROP TRIGGER IF EXISTS update_sms_messages_updated_at ON sms_messages;
CREATE TRIGGER update_sms_messages_updated_at
    BEFORE UPDATE ON sms_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for sms_templates
DROP TRIGGER IF EXISTS update_sms_templates_updated_at ON sms_templates;
CREATE TRIGGER update_sms_templates_updated_at
    BEFORE UPDATE ON sms_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
