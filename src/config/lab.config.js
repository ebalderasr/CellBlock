/**
 * ============================================================
 * CellBlock — Lab Configuration
 * ============================================================
 * Edit this file to adapt CellBlock to your laboratory.
 * No other file needs to be modified for a basic deployment.
 */

export const LAB_CONFIG = {
  // ── Identity ──────────────────────────────────────────────
  appName: 'CellBlock',
  suite: 'HostCell',
  labName: 'Grupo Palomares-Ramírez',
  institution: 'Instituto de Biotecnología, UNAM',

  // ── Admin / support contact ───────────────────────────────
  admin: {
    name: 'Emiliano Balderas',
    email: 'emiliano.balderas@ibt.unam.mx',
  },

  // ── Booking rules ─────────────────────────────────────────
  booking: {
    // Maximum consecutive 1-hour slots per user, per hood, per day
    maxConsecutiveHours: 3,
    // Total weeks visible in the calendar (including current week)
    weeksAhead: 4,
    // Weeks at this offset or beyond are locked for non-admin users
    lockedFromWeek: 2,
    // Day of week when locked weeks are released (0 = Sunday … 6 = Saturday)
    unlockDay: 6,
    // Hour (24-h) at which locked weeks become bookable on unlockDay
    unlockHour: 11,
  },
};
