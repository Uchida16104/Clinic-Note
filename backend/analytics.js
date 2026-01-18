/**
 * =========================================================
 * Clinic Note - Analytics & Data Processing
 * Path: /backend/analytics.js
 *
 * Purpose:
 * - Deterministic data aggregation
 * - Render-safe PostgreSQL access
 * - No side effects, read-only queries
 * =========================================================
 */

import { pool } from './db.js';

/**
 * Get memo count grouped by date
 * Used for simple preparation analytics
 */
export async function getMemoStats(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        date,
        COUNT(*) AS memo_count
      FROM memos
      GROUP BY date
      ORDER BY date ASC
    `);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * Get memos between two appointment dates
 * Used when an appointment date arrives
 */
export async function getMemosBetween(req, res) {
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({
      error: 'from and to dates are required'
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT date, content
      FROM memos
      WHERE date >= $1 AND date <= $2
      ORDER BY date ASC
      `,
      [from, to]
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
}
