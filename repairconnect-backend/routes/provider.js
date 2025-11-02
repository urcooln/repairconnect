import express from 'express';
import sql from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// repairconnect-backend/routes/provider.js
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const { id } = req.user;
    
    // Add error handling for missing user id
    if (!id) {
      console.error('No user ID in request');
      return res.status(400).json({ error: 'User ID is required' });
    }

    // First check if the user exists
    const [provider] = await sql`
      SELECT id, name, email, role, status, photo_url, roles
      FROM users
      WHERE id = ${id}
    `;

    if (!provider) {
      console.error(`No provider found with ID: ${id}`);
      return res.status(404).json({ error: 'Provider not found' });
    }

    // Handle null values gracefully
    const nameParts = typeof provider.name === 'string'
      ? provider.name.split(" ")
      : ["", ""];
    const rolesArray = typeof provider.roles === 'string'
      ? provider.roles.split(',').map(role => role.trim())
      : [];
    const photoUrl = provider.photo_url || null;

    res.json({
      firstName: nameParts[0] || '',
      lastName: nameParts[1] || '',
      email: provider.email || '',
      roles: rolesArray,
      photo: photoUrl,
      completedJobs: 0,
      newMessages: 0
    });

  } catch (err) {
    console.error('Failed to fetch provider profile:', err);
    res.status(500).json({ 
      error: 'Failed to fetch provider profile',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { id } = req.user;
    const { roles } = req.body;

    // Convert roles array to comma-separated string for storage
    const rolesString = Array.isArray(roles) ? roles.join(',') : '';

    const [updated] = await sql`
      UPDATE users
      SET roles = ${rolesString}
      WHERE id = ${id} AND role = 'provider'
      RETURNING id, name, email, role, status, photo_url, roles
    `;

    if (!updated) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    // Convert roles back to array for response
    updated.roles = updated.roles ? updated.roles.split(',') : [];

    res.json(updated);
  } catch (err) {
    console.error('Failed to update provider profile:', err);
    res.status(500).json({ error: 'Failed to update provider profile' });
  }
});

// Save provider profile changes to user_settings
router.post('/saveProfile', async (req, res) => {
  try {
    const { email, photo, roles } = req.body;

    if (!email || !photo || !Array.isArray(roles)) {
      return res.status(400).json({ error: 'Missing or invalid profile data' });
    }

    // Find the provider's user ID
    const [user] = await sql`
      SELECT id FROM users WHERE email = ${email} AND role = 'provider'
    `;

    if (!user) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    const rolesString = roles.join(',');

    // Insert or update their settings
    await sql`
      INSERT INTO user_settings (user_id, photo_url, roles, updated_at)
      VALUES (${user.id}, ${photo}, ${rolesString}, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET photo_url = ${photo}, roles = ${rolesString}, updated_at = NOW()
    `;

    res.status(200).json({ message: 'Profile saved successfully' });
  } catch (err) {
    console.error('Error saving profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;