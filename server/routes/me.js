const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { db } = require('../config/database');
const { ALLOWED_THEMES } = require('../config/themes');

// PATCH /api/me/preferences - Updates user personal preferences such as theme
router.patch('/preferences', authenticate, async (req, res) => {
  try {
    const { theme } = req.body;

    if (!theme || !ALLOWED_THEMES.includes(theme)) {
      return res.status(400).json({
        success: false,
        message: `Invalid theme '${theme}'. Allowed themes are: ${ALLOWED_THEMES.join(', ')}`
      });
    }

    await db.run('UPDATE users SET theme = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      theme,
      req.user.id
    ]);

    return res.json({
      success: true,
      message: 'Preferences updated successfully',
      theme
    });
  } catch (err) {
    console.error('Error updating user preferences:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update preferences'
    });
  }
});

// GET /api/me - Returns current authenticated user
router.get('/', authenticate, (req, res) => {
  return res.json({
    success: true,
    user: req.user
  });
});

module.exports = router;
