-- Migration: superadmin broadcast notifications
-- Adds:
--   1. Superadmin write policy on notifications table
--   2. broadcast_notification() RPC — inserts a custom notification for all active/trial businesses

-- 1. Allow superadmins to write notifications for any business
DROP POLICY IF EXISTS "notifications_superadmin_write" ON notifications;
CREATE POLICY "notifications_superadmin_write" ON notifications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_superadmin = true)
  );

-- 2. RPC: broadcast_notification
CREATE OR REPLACE FUNCTION broadcast_notification(
  p_title      text,
  p_message    text,
  p_action_url text    DEFAULT NULL,
  p_severity   text    DEFAULT 'info'
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
BEGIN
  -- Guard: only superadmins can call this
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND is_superadmin = true
  ) THEN
    RAISE EXCEPTION 'Superadmin required';
  END IF;

  -- Insert one notification per active/trial business
  INSERT INTO notifications (business_id, type, title, message, severity, action_url, is_read)
  SELECT
    id,
    'custom',
    p_title,
    p_message,
    p_severity,
    p_action_url,
    false
  FROM businesses
  WHERE subscription_status IN ('active', 'trial');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
