-- ─────────────────────────────────────────────────────────────────────────────
-- 0002b — derived interested_count trigger + reconcile  (STATUS: pending)
-- APPLY ONLY AFTER the P3 code is deployed (the code stops touching interested_count
-- manually). Ordering that avoids any miscount:
--   1. apply 0002a  2. deploy P3 code  3. apply THIS file
-- Between (2) and (3) interested_count briefly freezes (undercount); the reconcile
-- at the bottom trues it up exactly. It never double-counts.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_interested_count()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.sponsored_moves
       SET interested_count = interested_count + 1
     WHERE id = NEW.move_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.sponsored_moves
       SET interested_count = GREATEST(0, interested_count - 1)
     WHERE id = OLD.move_id;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_interested_count ON public.move_interested;
CREATE TRIGGER trg_interested_count
  AFTER INSERT OR DELETE ON public.move_interested
  FOR EACH ROW EXECUTE FUNCTION sync_interested_count();

-- One-time reconcile so counts match the source of truth. Safe to re-run any time.
UPDATE public.sponsored_moves m
   SET interested_count = COALESCE(
     (SELECT count(*) FROM public.move_interested i WHERE i.move_id = m.id), 0);
