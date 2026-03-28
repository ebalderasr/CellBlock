-- =============================================================================
-- CellBlock: allow extended bookings with optional notes
-- Run once in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- =============================================================================
-- Removes the hard 3-consecutive-hours block from book_slot().
-- The limit is now a soft warning enforced only on the client (UI modal).
-- Adds an optional p_notes parameter so the justification is saved atomically.
-- =============================================================================

CREATE OR REPLACE FUNCTION book_slot(
  p_hood_id    uuid,
  p_start_time timestamptz,
  p_notes      text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id   uuid        := auth.uid();
  v_end_time  timestamptz := p_start_time + interval '1 hour';
  v_user_code text;
BEGIN

  -- Serialize all writes for the same hood.
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

  -- ── Insert booking ────────────────────────────────────────────────────────
  INSERT INTO bookings (hood_id, user_id, user_name, start_time, end_time, notes)
  VALUES (
    p_hood_id,
    v_user_id,
    COALESCE(v_user_code, 'Unknown'),
    p_start_time,
    v_end_time,
    p_notes
  );

END;
$$;
