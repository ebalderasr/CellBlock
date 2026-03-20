-- =============================================================================
-- CellBlock: concurrent booking safety
-- Run once in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- =============================================================================

-- ── 1. Unique constraint ──────────────────────────────────────────────────────
-- Hard DB-level guard: two rows for the same hood + start_time are physically
-- impossible, regardless of application-level race conditions.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_hood_slot_unique'
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_hood_slot_unique UNIQUE (hood_id, start_time);
  END IF;
END;
$$;


-- ── 2. Index for fast range queries ──────────────────────────────────────────
-- Speeds up the calendar view query (hood_id + start_time range).

CREATE INDEX IF NOT EXISTS idx_bookings_hood_start
  ON bookings (hood_id, start_time);


-- ── 3. Enable Realtime on bookings ───────────────────────────────────────────
-- Allows the frontend Realtime subscription to receive INSERT/UPDATE/DELETE
-- events so all connected users see changes instantly.

ALTER PUBLICATION supabase_realtime ADD TABLE bookings;


-- ── 4. Atomic book_slot function ──────────────────────────────────────────────
-- Replaces the previous version with:
--   a) pg_advisory_xact_lock: serializes concurrent writes for the same hood
--      so the consecutive-hours check is never subject to a TOCTOU race.
--   b) Explicit slot-taken check with a clear error message.
--   c) Past-slot rejection moved here so it's enforced server-side too.

CREATE OR REPLACE FUNCTION book_slot(
  p_hood_id    uuid,
  p_start_time timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id   uuid        := auth.uid();
  v_end_time  timestamptz := p_start_time + interval '1 hour';
  v_user_code text;
  v_day_start timestamptz;
  v_day_end   timestamptz;
  v_hours     int[];
  v_sorted    int[];
  v_new_hour  int;
  v_max       int := 1;
  v_curr      int := 1;
  i           int;
BEGIN

  -- Serialize all writes for the same hood.
  -- pg_advisory_xact_lock is released automatically at transaction end.
  -- Using two-argument form: namespace=1, key=hashtext(hood_id).
  PERFORM pg_advisory_xact_lock(1, hashtext(p_hood_id::text));

  -- ── Guard: reject past slots ──────────────────────────────────────────────
  IF p_start_time < now() THEN
    RAISE EXCEPTION 'past_slot'
      USING HINT = 'No puedes reservar un horario que ya pasó.';
  END IF;

  -- ── Guard: reject already-taken slots ────────────────────────────────────
  IF EXISTS (
    SELECT 1 FROM bookings
    WHERE hood_id = p_hood_id AND start_time = p_start_time
  ) THEN
    RAISE EXCEPTION 'slot_taken'
      USING HINT = 'Este horario acaba de ser tomado por otro usuario.';
  END IF;

  -- ── Get user_code for display ─────────────────────────────────────────────
  SELECT user_code INTO v_user_code FROM profiles WHERE id = v_user_id;

  -- ── Consecutive hours check (3 max per user per hood per day) ────────────
  v_new_hour  := extract(hour from p_start_time AT TIME ZONE 'America/Mexico_City')::int;
  v_day_start := date_trunc('day', p_start_time AT TIME ZONE 'America/Mexico_City')
                   AT TIME ZONE 'America/Mexico_City';
  v_day_end   := v_day_start + interval '1 day';

  SELECT array_agg(
    extract(hour from start_time AT TIME ZONE 'America/Mexico_City')::int
    ORDER BY start_time
  )
  INTO v_hours
  FROM bookings
  WHERE user_id  = v_user_id
    AND hood_id  = p_hood_id
    AND start_time >= v_day_start
    AND start_time <  v_day_end;

  -- Merge existing hours + new hour, sort ascending
  SELECT array_agg(h ORDER BY h)
  INTO v_sorted
  FROM unnest(array_append(COALESCE(v_hours, '{}'::int[]), v_new_hour)) h;

  -- Find longest run of consecutive hours
  IF array_length(v_sorted, 1) > 1 THEN
    FOR i IN 1 .. array_length(v_sorted, 1) - 1 LOOP
      IF v_sorted[i + 1] = v_sorted[i] + 1 THEN
        v_curr := v_curr + 1;
      ELSE
        v_curr := 1;
      END IF;
      v_max := greatest(v_max, v_curr);
    END LOOP;
  END IF;

  IF v_max > 3 THEN
    RAISE EXCEPTION 'consecutive_limit'
      USING HINT = 'Límite GPR: Máximo 3 horas consecutivas por campana por día.';
  END IF;

  -- ── All checks passed → insert ────────────────────────────────────────────
  INSERT INTO bookings (hood_id, user_id, user_name, start_time, end_time)
  VALUES (
    p_hood_id,
    v_user_id,
    COALESCE(v_user_code, 'Unknown'),
    p_start_time,
    v_end_time
  );

END;
$$;
