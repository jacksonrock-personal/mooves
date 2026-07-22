-- ─────────────────────────────────────────────────────────────────────────────
-- 0004 — rate limiting (fixed-window, in Postgres)  (STATUS: pending)
-- Safe to apply any time: the code fails OPEN, so nothing breaks if this lands
-- before or after the P2 code deploys. Applying it first just means limits start
-- being enforced immediately.
--
-- Fixed-window counter: each (key, time-bucket) gets one row whose count is bumped
-- atomically. `key` encodes the route + caller (e.g. "auth-verify:1.2.3.4"), so
-- each route/window pairing is isolated. expires_at drives cheap cleanup.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key        text        NOT NULL,
  bucket     bigint      NOT NULL,
  count      int         NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (key, bucket)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON public.rate_limits(expires_at);

-- Service-role only; no client ever touches this. Default-deny.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Records one hit and returns TRUE if the caller is still under the limit,
-- FALSE if this hit puts them over. Atomic (single upsert) → race-safe.
CREATE OR REPLACE FUNCTION public.rate_limit_hit(
  p_key text,
  p_limit int,
  p_window_seconds int
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_bucket bigint := floor(extract(epoch FROM now()) / p_window_seconds);
  v_count  int;
BEGIN
  INSERT INTO public.rate_limits (key, bucket, count, expires_at)
  VALUES (p_key, v_bucket, 1, now() + make_interval(secs => p_window_seconds * 2))
  ON CONFLICT (key, bucket)
  DO UPDATE SET count = public.rate_limits.count + 1
  RETURNING count INTO v_count;

  -- Opportunistic cleanup of expired buckets (~1% of calls keeps the table small).
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limits WHERE expires_at < now();
  END IF;

  RETURN v_count <= p_limit;
END $$;
