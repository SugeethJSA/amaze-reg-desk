CREATE OR REPLACE FUNCTION reevaluate_scans_on_rule_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If rule is deactivated, deny all its accepted scans
  IF NEW.active = FALSE THEN
    UPDATE scan_events
    SET status = 'denied', reason = 'Rule was deactivated retroactively.'
    WHERE rule_id = NEW.id AND status = 'accepted';
  ELSE
    -- If rule is active, verify the timeframe for existing scans associated with it
    
    -- 1. Deny accepted scans that now fall outside the timeframe
    UPDATE scan_events
    SET status = 'denied', reason = 'Scan time falls outside the updated rule timeframe.'
    WHERE rule_id = NEW.id AND status = 'accepted'
      AND (
        (NEW.starts_at IS NOT NULL AND scanned_at < NEW.starts_at) OR
        (NEW.ends_at IS NOT NULL AND scanned_at > NEW.ends_at)
      );
      
    -- 2. Accept denied scans (if they were denied strictly due to timeframe/no active rule) that now fall inside
    UPDATE scan_events
    SET status = 'accepted', reason = 'Accepted retroactively due to rule update.'
    WHERE rule_id = NEW.id AND status = 'denied'
      AND (NEW.starts_at IS NULL OR scanned_at >= NEW.starts_at)
      AND (NEW.ends_at IS NULL OR scanned_at <= NEW.ends_at);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reevaluate_scans ON scan_rules;

CREATE TRIGGER trigger_reevaluate_scans
AFTER UPDATE ON scan_rules
FOR EACH ROW
WHEN (OLD.active IS DISTINCT FROM NEW.active OR OLD.starts_at IS DISTINCT FROM NEW.starts_at OR OLD.ends_at IS DISTINCT FROM NEW.ends_at)
EXECUTE FUNCTION reevaluate_scans_on_rule_update();
