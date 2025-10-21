import express from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/profile', requireAuth, async (req, res) => {
  try {
    const { id } = req.user;
    const [provider] = await sql`
      SELECT id, name, email, role, status, photo_url, roles
      FROM users
      WHERE id = ${id} AND role = 'provider'
    `;

    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    // Split the roles if they're stored as a comma-separated string
    if (typeof provider.roles === 'string') {
      provider.roles = provider.roles.split(',').map(role => role.trim());
    }

    res.json(provider);
  } catch (err) {
    console.error('Failed to fetch provider profile:', err);
    res.status(500).json({ error: 'Failed to fetch provider profile' });
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

export default router;