// repairconnect-backend/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import sql from "./db.js"; // ✅ Supabase-style import
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import crypto from 'crypto';

const app = express();

// pull values from .env
const { ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET } = process.env;
const PORT = process.env.PORT || 8081;

app.use(cors({ origin: "http://localhost:3000" }));
// capture raw body for routes that need the exact bytes (Stripe webhook)
app.use(express.json({ limit: "10mb", verify: (req, res, buf) => { req.rawBody = buf } }));

// NOTE: Stripe is loaded dynamically in endpoints so the app can run without the package installed.

// ensure upload folder exists and serve it
const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// multer for multipart/form-data file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const safe = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '_');
    cb(null, safe);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// ✅ Public root route (for testing)
app.get("/", (req, res) => {
  console.log("GET / hit ✅");
  res.send("Backend is working!");
});

// Debug: show service_requests column types
app.get('/debug/schema/service_requests', requireAuth, async (req, res) => {
  try {
    const rows = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'service_requests'
      ORDER BY ordinal_position
    `;
    res.json(rows);
  } catch (err) {
    console.error('Debug schema failed:', err);
    res.status(500).json({ error: 'Debug failed' });
  }
});

// ✅ Admin login (hardcoded from .env)
app.post("/auth/admin/login", (req, res) => {
  const { email, password } = req.body || {};
  console.log("POST /auth/admin/login", email);

  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ role: "admin", email }, JWT_SECRET, { expiresIn: "2h" });
    return res.json({ token });
  }
  return res.status(401).json({ error: "Invalid credentials" });
});

// ✅ Middleware
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // normalize id to number when present to avoid integer=text SQL errors
    if (payload && payload.id) {
      payload.id = Number.parseInt(payload.id, 10);
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireAdmin(req, res, next) {
  if ((req.user?.role || "").toLowerCase() !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

function requireProvider(req, res, next) {
  if ((req.user?.role || "").toLowerCase() !== "provider") {
    return res.status(403).json({ error: "Provider access required" });
  }
  next();
}

let providerSchemaReadyPromise = null;
let serviceRequestSchemaReadyPromise = null;

async function ensureProviderSchema() {
  if (!providerSchemaReadyPromise) {
    providerSchemaReadyPromise = (async () => {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS roles TEXT[]`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT`;
      await sql`
        CREATE TABLE IF NOT EXISTS provider_profiles (
          user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          company_name TEXT,
          skills TEXT,
          hourly_rate NUMERIC(10,2),
          bio TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
    })().catch((err) => {
      providerSchemaReadyPromise = null;
      throw err;
    });
  }

  return providerSchemaReadyPromise;
}

async function ensureServiceRequestSchema() {
  if (!serviceRequestSchemaReadyPromise) {
    serviceRequestSchemaReadyPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS service_requests (
          id SERIAL PRIMARY KEY,
          customer_id INTEGER,
          title TEXT,
          category TEXT,
          description TEXT
        )
      `;

      await sql`
        ALTER TABLE service_requests
        ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES users(id) ON DELETE CASCADE
      `;

      await sql`
        ALTER TABLE service_requests
        ADD COLUMN IF NOT EXISTS title TEXT
      `;

      await sql`
        ALTER TABLE service_requests
        ADD COLUMN IF NOT EXISTS category TEXT
      `;

      await sql`
        ALTER TABLE service_requests
        ADD COLUMN IF NOT EXISTS description TEXT
      `;

      await sql`ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS preferred_date TIMESTAMP`;
      await sql`ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending'`;
      await sql`ALTER TABLE service_requests ALTER COLUMN status SET DEFAULT 'pending'`;
      await sql`ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`;
      await sql`ALTER TABLE service_requests ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP`;
      await sql`ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`;
      await sql`ALTER TABLE service_requests ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP`;
      await sql`ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS preferred_timezone TEXT`;
        await sql`ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS assigned_provider_id INTEGER REFERENCES users(id)`;

      const columns = await sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'service_requests'
          AND column_name = ANY(${["preferred_date", "created_at", "updated_at"]})
      `;

      const columnType = (name) =>
        columns.find((col) => col.column_name === name)?.data_type ?? null;

      if (columnType("preferred_date") !== "timestamp with time zone") {
        await sql`
          ALTER TABLE service_requests
          ALTER COLUMN preferred_date
          TYPE TIMESTAMPTZ
          USING
            CASE
              WHEN preferred_date IS NULL THEN NULL
              ELSE preferred_date AT TIME ZONE 'UTC'
            END
        `;
      }

      if (columnType("created_at") !== "timestamp with time zone") {
        await sql`
          ALTER TABLE service_requests
          ALTER COLUMN created_at
          TYPE TIMESTAMPTZ
          USING
            CASE
              WHEN created_at IS NULL THEN NULL
              ELSE created_at AT TIME ZONE 'UTC'
            END
        `;
      }

      if (columnType("updated_at") !== "timestamp with time zone") {
        await sql`
          ALTER TABLE service_requests
          ALTER COLUMN updated_at
          TYPE TIMESTAMPTZ
          USING
            CASE
              WHEN updated_at IS NULL THEN NULL
              ELSE updated_at AT TIME ZONE 'UTC'
            END
        `;
      }

      await sql`CREATE INDEX IF NOT EXISTS idx_service_requests_customer ON service_requests(customer_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status)`;
      // job updates and notifications tables
      await sql`
        CREATE TABLE IF NOT EXISTS job_updates (
          id SERIAL PRIMARY KEY,
          service_request_id INTEGER REFERENCES service_requests(id) ON DELETE CASCADE,
          provider_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          message TEXT,
          image_url TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          type TEXT,
          payload JSONB,
          read BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS invoices (
          id SERIAL PRIMARY KEY,
          service_request_id INTEGER REFERENCES service_requests(id) ON DELETE CASCADE,
          provider_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          customer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          amount NUMERIC(10,2) NOT NULL,
          currency TEXT DEFAULT 'USD',
          notes TEXT,
          paid BOOLEAN DEFAULT false,
          paid_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      // Ensure expected invoice columns exist (fixes older schemas missing 'amount' etc.)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2)`;
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD'`;
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT`;
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT false`;
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP`;
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`;
    })().catch((err) => {
      serviceRequestSchemaReadyPromise = null;
      throw err;
    });
  }

  return serviceRequestSchemaReadyPromise;
}

// ✅ Register new users
app.post("/auth/register", async (req, res) => {
  const { name, email, password, role } = req.body;
  console.log("REGISTER payload:", req.body);

  try {
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const [existing] = await sql`
      SELECT id FROM users WHERE email = ${email}
    `;

    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }

    await ensureProviderSchema();

    const hashedPassword = await bcrypt.hash(password, 10);

    // Set initial status for providers
    const status = role === "provider" ? "pending" : "active";

    const result = await sql`
      INSERT INTO users (name, email, password_hash, role, status)
      VALUES (${name}, ${email}, ${hashedPassword}, ${role}, ${status})
      RETURNING id, email, role, status
    `;

    res.json({ message: "User registered", user: result[0] });
  } catch (err) {
    console.error("Registration failed:", err);

    if (err.code === "23505") {
      return res.status(400).json({ error: "Email already registered" });
    }

    res.status(500).json({ error: err.message || "Registration failed" });
  }
});

// ✅ Customer login (with status check)
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const adminToken = jwt.sign({ email, role: "admin" }, JWT_SECRET, { expiresIn: "2h" });
      return res.json({ token: adminToken });
    }

    const result = await sql`
      SELECT * FROM users WHERE email = ${email}
    `;
    const user = result[0];

    if (!user) return res.status(401).json({ error: "User not found" });

    // 🧠 Check user status before allowing login
    const status = (user.status || "active").toLowerCase();

    // Check if user is banned or suspended before login
    if (user.status === "banned") {
      return res.status(403).json({ error: "Your account has been permanently banned." });
    }

    if (user.status === "suspended") {
      const [{ remaining_seconds: remainingSecondsRaw = 0 } = {}] = await sql`
        SELECT EXTRACT(EPOCH FROM (suspended_until - NOW())) AS remaining_seconds
        FROM users
        WHERE id = ${user.id}
      `;

      const remainingSeconds = Number(remainingSecondsRaw);

      if (remainingSeconds > 0) {
        const remainingHours = Math.ceil(remainingSeconds / 3600);
        return res.status(403).json({
          error: `Your account is suspended for another ${remainingHours} hour(s).`,
        });
      }

      // Suspension expired — reactivate user
      await sql`
        UPDATE users SET status = 'active', suspended_until = NULL WHERE id = ${user.id}`;
      user.status = "active";
      user.suspended_until = null;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid password" });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, status: user.status },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({ token });
  } catch (err) {
    console.error("Login failed:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ✅ Password reset
app.post("/auth/reset-password", async (req, res) => {
  const { email, newPassword } = req.body || {};

  if (!email || !newPassword) {
    return res.status(400).json({ error: "Email and newPassword are required." });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const result = await sql`
      UPDATE users
      SET password_hash = ${hashedPassword}
      WHERE email = ${email}
      RETURNING id, email
    `;

    if (!result.length) {
      return res.status(404).json({ error: "No user found with that email." });
    }

    res.json({ message: "Password successfully reset." });
  } catch (err) {
    console.error("Error resetting password:", err);
    res.status(500).json({ error: "Failed to reset password." });
  }
});

// ✅ DB health check route
app.get("/db-check", async (req, res) => {
  try {
    const result = await sql`SELECT NOW()`;
    res.json({ db_time: result[0].now });
  } catch (err) {
    console.error("DB check failed:", err);
    res.status(500).json({ error: "Database not reachable" });
  }
});

// ✅ Protected admin summary route
app.get("/admin/summary", requireAuth, requireAdmin, (req, res) => {
  console.log("GET /admin/summary by", req.user.email);
  res.json({
    message: "Welcome, Admin!",
    stats: {
      totalUsers: 5,
      totalRequests: 10,
      pendingJobs: 3,
    },
  });
});

// ✅ List all users (without passwords)
app.get("/admin/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await sql`
      SELECT id, name, email, role, status, suspended_until
      FROM users
      ORDER BY id
    `;
    res.json(users);
  } catch (err) {
    console.error("Failed to load users:", err);
    res.status(500).json({ error: "Failed to load users" });
  }
});

// List all service requests
app.get("/admin/requests", requireAuth, requireAdmin, async (req, res) => {
  try {
    const requests = await sql`
      SELECT sr.id, u.name AS customer_name, sr.title, sr.category, sr.description, sr.status
      FROM service_requests sr LEFT JOIN users u ON sr.customer_id = u.id
      ORDER by id
    `;
    res.json(requests);
  } catch (err) {
    console.error("Failed to load requests:", err);
    res.status(500).json({ error: "Failed to load requests" });
  }
});

// ✅ Delete a user
app.delete("/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
  const userId = Number.parseInt(req.params.id, 10);

  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    const deleted = await sql`
      DELETE FROM users
      WHERE id = ${userId}
      RETURNING id
    `;

    if (deleted.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User deleted", id: deleted[0].id });
  } catch (err) {
    console.error("Failed to delete user:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

//Delete a service request
app.delete("/admin/requests/:id", requireAuth, requireAdmin, async (req, res) => {
  const requestId = Number.parseInt(req.params.id, 10);

  if (Number.isNaN(requestId)) {
    return res.status(400).json({ error: "Invalid request id" });
  }

  try {
    const deleted = await sql`
      DELETE FROM service_requests
      WHERE id = ${requestId}
      RETURNING id
    `;

    if (deleted.length === 0) {
      return res.status(404).json({ error: "Service request not found" });
    }

    res.json({ message: "Service request deleted", id: deleted[0].id });
  } catch (err) {
    console.error("Failed to delete service request:", err);
    res.status(500).json({ error: "Failed to delete service request" });
  }
});

// ✅ Approve a provider
app.put("/admin/users/:id/approve", requireAuth, requireAdmin, async (req, res) => {
  const userId = Number.parseInt(req.params.id, 10);

  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    const approved = await sql`
      UPDATE users
      SET status = 'active'
      WHERE id = ${userId} AND role = 'provider'
      RETURNING id, status
    `;

    if (approved.length === 0) {
      return res.status(404).json({ error: "Provider not found or user is not a provider" });
    }

    res.json({ message: "Provider approved", user: approved[0] });
  } catch (err) {
    console.error("Failed to approve provider:", err);
    res.status(500).json({ error: "Failed to approve provider" });
  }
});

// ✅ Suspend user temporarily (duration in hours)
app.post("/admin/users/:id/suspend", async (req, res) => {
  const { id } = req.params;
  const { duration } = req.body || {};

  try {
    // Default: 24 hours if not specified
    const suspendHours = parseInt(duration, 10) || 24;

    // Calculate suspension end time
    const suspendUntil = new Date(Date.now() + suspendHours * 60 * 60 * 1000);

    const updated = await sql`
      UPDATE users
      SET status = 'suspended',
          suspended_until = ${suspendUntil}
      WHERE id = ${id}
      RETURNING id, name, email, role, status, suspended_until;
    `;

    if (!updated.length) {
      return res.status(404).json({ error: "User not found." });
    }

    console.log(
      `⚠️ User ${id} suspended for ${suspendHours}h (until ${suspendUntil.toISOString()})`
    );

    res.json(updated[0]);
  } catch (err) {
    console.error("Error suspending user:", err);
    res.status(500).json({ error: "Failed to suspend user." });
  }
});

// ✅ Ban User
app.post("/admin/users/:id/ban", async (req, res) => {
  const { id } = req.params;

  try {
    const updated = await sql`
      UPDATE users
      SET status = 'banned',
          suspended_until = NULL
      WHERE id = ${id}
      RETURNING id, name, email, role, status, suspended_until;
    `;

    if (!updated.length) {
      return res.status(404).json({ error: "User not found." });
    }

    res.json(updated[0]);
  } catch (err) {
    console.error("Error banning user:", err);
    res.status(500).json({ error: "Failed to ban user." });
  }
});

// ✅ Reactivate User
app.post("/admin/users/:id/activate", async (req, res) => {
  const { id } = req.params;

  try {
    const updated = await sql`
      UPDATE users
      SET status = 'active',
          suspended_until = NULL
      WHERE id = ${id}
      RETURNING id, name, email, role, status, suspended_until;
    `;

    if (!updated.length) {
      return res.status(404).json({ error: "User not found." });
    }

    res.json(updated[0]);
  } catch (err) {
    console.error("Error reactivating user:", err);
    res.status(500).json({ error: "Failed to reactivate user." });
  }
});

// ✅ Provider profile routes
app.get("/provider/profile", requireAuth, async (req, res) => {
  try {
    await ensureProviderSchema();

    if (!req.user?.id) {
      return res.status(400).json({ error: "Missing provider id" });
    }

    const [provider] = await sql`
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.roles,
        u.photo_url,
        pp.company_name,
        pp.skills,
        pp.hourly_rate,
        pp.bio
      FROM users u
      LEFT JOIN provider_profiles pp ON pp.user_id = u.id
      WHERE u.id = ${req.user.id} AND LOWER(u.role) = 'provider'
    `;

    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }

    const [firstName = "", ...rest] = typeof provider.name === "string"
      ? provider.name.trim().split(/\s+/)
      : [""];
    const lastName = rest.join(" ");

    let parsedRoles = [];
    if (Array.isArray(provider.roles)) {
      parsedRoles = provider.roles;
    } else if (typeof provider.roles === "string" && provider.roles.length > 0) {
      parsedRoles = provider.roles.split(",").map((role) => role.trim());
    }
    if (parsedRoles.length === 0 && provider.role) {
      parsedRoles = [provider.role];
    }

    let skills = [];
    if (Array.isArray(provider.skills)) {
      skills = provider.skills;
    } else if (typeof provider.skills === "string" && provider.skills.length > 0) {
      try {
        skills = JSON.parse(provider.skills);
      } catch {
        skills = provider.skills.split(",").map((skill) => skill.trim());
      }
    }

    // compute some provider stats
    const [{ cnt: completedCnt } = { cnt: 0 }] = await sql`SELECT COUNT(*)::int AS cnt FROM service_requests WHERE assigned_provider_id = ${req.user.id} AND status = 'done'`;
    const [{ cnt: ongoingCnt } = { cnt: 0 }] = await sql`SELECT COUNT(*)::int AS cnt FROM service_requests WHERE assigned_provider_id = ${req.user.id} AND status = 'ongoing'`;
    const [{ cnt: unreadCnt } = { cnt: 0 }] = await sql`SELECT COUNT(*)::int AS cnt FROM notifications WHERE user_id = ${req.user.id} AND read = false`;

    res.json({
      firstName,
      lastName,
      email: provider.email,
      company: provider.company_name || "",
      skills,
      hourlyRate: provider.hourly_rate ? Number(provider.hourly_rate) : null,
      roles: parsedRoles,
      photoUrl: provider.photo_url || null,
      bio: provider.bio || "",
      completedJobs: completedCnt || 0,
      ongoingJobs: ongoingCnt || 0,
      newMessages: unreadCnt || 0,
    });
  } catch (err) {
    console.error("Error fetching provider profile:", err);
    res.status(500).json({ error: "Failed to fetch provider profile" });
  }
});

app.put("/provider/profile", requireAuth, async (req, res) => {
  try {
    await ensureProviderSchema();

    const { id } = req.user || {};

    if (!id) {
      return res.status(400).json({ error: "Missing provider id" });
    }

    const {
      firstName,
      lastName,
      company,
      skills = [],
      hourlyRate,
      roles = [],
      photoUrl,
      bio,
    } = req.body || {};

    const [existing] = await sql`
      SELECT id, name, roles, photo_url
      FROM users
      WHERE id = ${id} AND LOWER(role) = 'provider'
    `;

    if (!existing) {
      return res.status(404).json({ error: "Provider not found" });
    }

    const fullNameParts = [firstName, lastName].map((part) =>
      typeof part === "string" ? part.trim() : ""
    );
    const fullName = fullNameParts.filter(Boolean).join(" ") || existing.name;

    const normalizedRoles = Array.isArray(roles)
      ? roles.map((role) => role.trim()).filter(Boolean)
      : Array.isArray(existing.roles)
      ? existing.roles
      : [];

    const normalizedSkills = Array.isArray(skills)
      ? skills.map((skill) => (typeof skill === "string" ? skill.trim() : "")).filter(Boolean)
      : [];

    const hourlyRateNumber =
      typeof hourlyRate === "number"
        ? hourlyRate
        : typeof hourlyRate === "string"
        ? Number.parseFloat(hourlyRate)
        : null;
    const safeHourlyRate = Number.isFinite(hourlyRateNumber) ? hourlyRateNumber : null;

    const normalizedCompany =
      typeof company === "string" ? company.trim() || null : company || null;
    const normalizedBio =
      typeof bio === "string" ? bio.trim() || null : bio || null;

    await sql.begin(async (tx) => {
      await tx`
        UPDATE users
        SET
          name = ${fullName},
          roles = ${sql.array(normalizedRoles)},
          photo_url = ${photoUrl ?? existing.photo_url}
        WHERE id = ${id} AND LOWER(role) = 'provider'
      `;

      await tx`
        INSERT INTO provider_profiles (user_id, company_name, skills, hourly_rate, bio, updated_at)
        VALUES (${id}, ${normalizedCompany}, ${JSON.stringify(normalizedSkills)}, ${safeHourlyRate}, ${normalizedBio}, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
          company_name = EXCLUDED.company_name,
          skills = EXCLUDED.skills,
          hourly_rate = EXCLUDED.hourly_rate,
          bio = EXCLUDED.bio,
          updated_at = NOW()
      `;
    });

    res.json({
      firstName: fullNameParts[0] || "",
      lastName: fullNameParts.slice(1).join(" "),
      company: normalizedCompany || "",
      skills: normalizedSkills,
      hourlyRate: safeHourlyRate,
      roles: normalizedRoles,
      photoUrl: photoUrl ?? existing.photo_url,
      bio: normalizedBio || "",
    });
  } catch (err) {
    console.error("Failed to update provider profile:", err);
    res.status(500).json({ error: "Failed to update provider profile" });
  }
});

// ✅ Customer profile routes (view and update own profile)
app.get('/customer/profile', requireAuth, async (req, res) => {
  try {
    const { id } = req.user || {};
    if (!id) return res.status(400).json({ error: 'Missing user id' });

    const [user] = await sql`
      SELECT id, name, email, phone, photo_url, address
      FROM users
      WHERE id = ${id}
    `;

    if (!user) return res.status(404).json({ error: 'User not found' });

    const [firstName = '', ...rest] = typeof user.name === 'string' ? user.name.trim().split(/\s+/) : [''];
    const lastName = rest.join(' ');

    res.json({
      firstName,
      lastName,
      email: user.email,
      phone: user.phone || '',
      photoUrl: user.photo_url || null,
      address: user.address || ''
    });
  } catch (err) {
    console.error('Error fetching customer profile:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.put('/customer/profile', requireAuth, async (req, res) => {
  try {
    const { id } = req.user || {};
    if (!id) return res.status(400).json({ error: 'Missing user id' });

    const { firstName, lastName, phone } = req.body || {};

    const { photoUrl, address } = req.body || {};

    const nameParts = [firstName, lastName].map((p) => (typeof p === 'string' ? p.trim() : '')).filter(Boolean);
    const fullName = nameParts.join(' ');

    const [existing] = await sql`SELECT id, name FROM users WHERE id = ${id}`;
    if (!existing) return res.status(404).json({ error: 'User not found' });

    await sql`
      UPDATE users
      SET name = ${fullName || existing.name},
          phone = ${phone ?? existing.phone},
          photo_url = ${photoUrl ?? existing.photo_url},
          address = ${address ?? existing.address}
      WHERE id = ${id}
    `;

    res.json({ firstName: nameParts[0] || '', lastName: nameParts.slice(1).join(' '), phone: phone || '', photoUrl: photoUrl || '', address: address || '' });
  } catch (err) {
    console.error('Error updating customer profile:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ✅ Create new service request
app.post("/service-requests", requireAuth, async (req, res) => {
  const {
    title: rawTitle,
    category,
    description,
    preferred_date,
    preferred_timezone,
  } = req.body;
  const title = (rawTitle || "").trim();
  const descriptionText = description?.trim();
  const customerId = req.user.id;
  let normalizedPreferredDate = null;
  const preferredTimezone =
    typeof preferred_timezone === "string" && preferred_timezone.trim().length > 0
      ? preferred_timezone.trim()
      : null;

  if (!title || !category || !descriptionText) {
    return res.status(400).json({ 
      error: "Title, category, and description are required" 
    });
  }

  if (preferred_date) {
    const parsedPreferred = new Date(preferred_date);
    if (Number.isNaN(parsedPreferred.getTime())) {
      return res.status(400).json({ error: "Invalid preferred date format" });
    }
    normalizedPreferredDate = parsedPreferred.toISOString();
  }

  try {
    await ensureServiceRequestSchema();

    const result = await sql`
      INSERT INTO service_requests (
        customer_id,
        title,
        category,
        description,
        preferred_date,
        preferred_timezone,
        status
      )
      VALUES (
        ${customerId},
        ${title},
        ${category},
        ${descriptionText},
        ${normalizedPreferredDate},
        ${preferredTimezone},
        'pending'
      )
      RETURNING *
    `;

    console.log(`✅ Service request created by user ${customerId}`);
    res.status(201).json({
      message: "Service request created successfully",
      request: result[0]
    });
  } catch (err) {
    console.error("Error creating service request:", err);
    res.status(500).json({
      error: err?.message || "Failed to create service request",
      detail: err?.detail || null,
    });
  }
});

// ✅ Allow providers to view open service requests
app.get("/provider/jobs", requireAuth, requireProvider, async (req, res) => {
  const categoryFilter =
    typeof req.query?.category === "string" && req.query.category.trim().length > 0
      ? req.query.category.trim()
      : null;

  try {
    await ensureServiceRequestSchema();

    const requests = categoryFilter
      ? await sql`
          SELECT
            sr.id,
            sr.title,
            sr.category,
            sr.description,
            sr.preferred_date,
            sr.preferred_timezone,
            sr.status,
            sr.created_at,
            u.name AS customer_name,
            u.email AS customer_email,
            u.phone AS customer_phone
          FROM service_requests sr
          JOIN users u ON u.id = sr.customer_id
          WHERE sr.status = 'pending' AND LOWER(sr.category) = LOWER(${categoryFilter})
          ORDER BY sr.created_at DESC
        `
      : await sql`
          SELECT
            sr.id,
            sr.title,
            sr.category,
            sr.description,
            sr.preferred_date,
            sr.preferred_timezone,
            sr.status,
            sr.created_at,
            u.name AS customer_name,
            u.email AS customer_email,
            u.phone AS customer_phone,
            sr.assigned_provider_id
          FROM service_requests sr
          JOIN users u ON u.id = sr.customer_id
          WHERE sr.status = 'pending'
          ORDER BY sr.created_at DESC
        `;

    res.json(
      requests.map((request) => {
        const serializeDate = (value) => {
          if (!value) return null;
          if (value instanceof Date) return value.toISOString();
          const parsed = new Date(value);
          return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
        };

        return {
          id: request.id,
          title: request.title,
          category: request.category,
          description: request.description,
          preferredDate: serializeDate(request.preferred_date),
          preferredTimezone: request.preferred_timezone || null,
          status: request.status,
          createdAt: serializeDate(request.created_at),
          customerName: request.customer_name || "",
          customerEmail: request.customer_email || "",
          customerPhone: request.customer_phone || "",
          assignedProviderId: request.assigned_provider_id || null,
          assignedToMe: request.assigned_provider_id === req.user.id,
        };
      })
    );
  } catch (err) {
    console.error("Error fetching provider jobs:", err);
    res.status(500).json({ error: "Failed to fetch service requests" });
  }
});

// ✅ Allow providers to update job status (take/start/finish)
app.put('/provider/jobs/:id/status', requireAuth, requireProvider, async (req, res) => {
  const jobId = Number.parseInt(req.params.id, 10);
  const { status } = req.body || {};
  const allowed = ['taken', 'ongoing', 'done'];

  if (Number.isNaN(jobId) || !allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid job id or status' });
  }

  try {
    await ensureServiceRequestSchema();

    const [existing] = await sql`SELECT id, status, customer_id, assigned_provider_id FROM service_requests WHERE id = ${jobId}`;
    if (!existing) return res.status(404).json({ error: 'Job not found' });

    const current = existing.status || 'pending';
    const providerId = req.user.id;

    // Transition rules
    if (status === 'taken') {
      if (current !== 'pending') return res.status(400).json({ error: 'Job must be pending to take' });
      await sql`UPDATE service_requests SET status = 'taken', assigned_provider_id = ${providerId}, updated_at = NOW() WHERE id = ${jobId}`;
      return res.json({ message: 'Job taken' });
    }

    if (status === 'ongoing') {
      if (current !== 'taken') return res.status(400).json({ error: 'Job must be taken to start' });
      if (existing.assigned_provider_id !== providerId) return res.status(403).json({ error: 'Only assigned provider can start the job' });
      await sql`UPDATE service_requests SET status = 'ongoing', updated_at = NOW() WHERE id = ${jobId}`;
      return res.json({ message: 'Job started' });
    }

    if (status === 'done') {
      if (!['ongoing','taken'].includes(current)) return res.status(400).json({ error: 'Job must be in progress to finish' });
      if (existing.assigned_provider_id !== providerId) return res.status(403).json({ error: 'Only assigned provider can finish the job' });
      await sql`UPDATE service_requests SET status = 'done', updated_at = NOW() WHERE id = ${jobId}`;
      return res.json({ message: 'Job completed' });
    }

    return res.status(400).json({ error: 'Unsupported status transition' });
  } catch (err) {
    console.error('Error updating job status:', err);
    res.status(500).json({ error: 'Failed to update job status' });
  }
});

// Generic job status update endpoint (works for admin, provider, customer with role checks)
app.put('/jobs/:id/status', requireAuth, async (req, res) => {
  const jobId = Number.parseInt(req.params.id, 10);
  let { status } = req.body || {};
  if (!status || typeof status !== 'string') return res.status(400).json({ error: 'Missing status' });
  status = status.toLowerCase();

  // accept 'inprogress' as alias for 'ongoing'
  if (status === 'inprogress') status = 'ongoing';

  const allowedStatuses = ['pending', 'taken', 'ongoing', 'paused', 'done', 'closed', 'cancelled'];
  if (!allowedStatuses.includes(status)) return res.status(400).json({ error: 'Unsupported status' });

  try {
    await ensureServiceRequestSchema();
    const [existing] = await sql`SELECT id, status, customer_id, assigned_provider_id FROM service_requests WHERE id = ${jobId}`;
    if (!existing) return res.status(404).json({ error: 'Job not found' });

    const current = (existing.status || 'pending').toLowerCase();
    const userRole = (req.user?.role || '').toLowerCase();
    const userId = req.user?.id;

    // Admin can set any status
    if (userRole === 'admin') {
      await sql`UPDATE service_requests SET status = ${status}, updated_at = NOW() WHERE id = ${jobId}`;
      // notify customer about admin status change
      try {
        await sql`INSERT INTO notifications (user_id, type, payload) VALUES (${existing.customer_id}, 'job_status', ${sql.json({ jobId, status, by: userId, role: userRole })})`;
      } catch (nerr) {
        console.error('Failed to create notification for admin status change:', nerr);
      }
      return res.json({ message: 'Job status updated by admin' });
    }

    // Provider rules
    if (userRole === 'provider') {
      const providerId = userId;
      if (status === 'taken') {
        if (current !== 'pending') return res.status(400).json({ error: 'Job must be pending to take' });
        await sql`UPDATE service_requests SET status = 'taken', assigned_provider_id = ${providerId}, updated_at = NOW() WHERE id = ${jobId}`;
        // notify customer that their job was taken
        try {
          await sql`INSERT INTO notifications (user_id, type, payload) VALUES (${existing.customer_id}, 'job_status', ${sql.json({ jobId, status: 'taken', by: providerId, role: 'provider' })})`;
        } catch (nerr) {
          console.error('Failed to create notification for job taken:', nerr);
        }
        return res.json({ message: 'Job taken' });
      }

      if (status === 'ongoing') {
        if (!['taken','paused'].includes(current)) return res.status(400).json({ error: 'Job must be taken or paused to start' });
        if (existing.assigned_provider_id !== providerId) return res.status(403).json({ error: 'Only assigned provider can start the job' });
        await sql`UPDATE service_requests SET status = 'ongoing', updated_at = NOW() WHERE id = ${jobId}`;
        try {
          await sql`INSERT INTO notifications (user_id, type, payload) VALUES (${existing.customer_id}, 'job_status', ${sql.json({ jobId, status: 'ongoing', by: providerId, role: 'provider' })})`;
        } catch (nerr) {
          console.error('Failed to create notification for job started:', nerr);
        }
        return res.json({ message: 'Job started' });
      }

      if (status === 'paused') {
        if (current !== 'ongoing') return res.status(400).json({ error: 'Job must be in progress to pause' });
        if (existing.assigned_provider_id !== providerId) return res.status(403).json({ error: 'Only assigned provider can pause the job' });
        await sql`UPDATE service_requests SET status = 'paused', updated_at = NOW() WHERE id = ${jobId}`;
        try {
          await sql`INSERT INTO notifications (user_id, type, payload) VALUES (${existing.customer_id}, 'job_status', ${sql.json({ jobId, status: 'paused', by: providerId, role: 'provider' })})`;
        } catch (nerr) {
          console.error('Failed to create notification for job paused:', nerr);
        }
        return res.json({ message: 'Job paused' });
      }

      if (status === 'done') {
        if (!['ongoing','taken'].includes(current)) return res.status(400).json({ error: 'Job must be in progress or taken to finish' });
        if (existing.assigned_provider_id !== providerId) return res.status(403).json({ error: 'Only assigned provider can finish the job' });
        await sql`UPDATE service_requests SET status = 'done', updated_at = NOW() WHERE id = ${jobId}`;
        try {
          await sql`INSERT INTO notifications (user_id, type, payload) VALUES (${existing.customer_id}, 'job_status', ${sql.json({ jobId, status: 'done', by: providerId, role: 'provider' })})`;
        } catch (nerr) {
          console.error('Failed to create notification for job completed:', nerr);
        }
        return res.json({ message: 'Job completed' });
      }

      if (status === 'closed') {
        // provider may close a job after it's done (finalize/archive)
        if (current !== 'done') return res.status(400).json({ error: 'Job must be done before closing' });
        if (existing.assigned_provider_id !== providerId) return res.status(403).json({ error: 'Only assigned provider can close the job' });
        await sql`UPDATE service_requests SET status = 'closed', updated_at = NOW() WHERE id = ${jobId}`;
        try {
          await sql`INSERT INTO notifications (user_id, type, payload) VALUES (${existing.customer_id}, 'job_status', ${sql.json({ jobId, status: 'closed', by: providerId, role: 'provider' })})`;
        } catch (nerr) {
          console.error('Failed to create notification for job closed:', nerr);
        }
        return res.json({ message: 'Job closed' });
      }

      return res.status(400).json({ error: 'Unsupported provider transition' });
    }

    // Customer rules: can cancel their own pending/taken jobs
    if (userRole === 'customer') {
      if (existing.customer_id !== userId) return res.status(403).json({ error: 'Only job owner can change this status' });
      if (status === 'cancelled') {
        if (!['pending','taken'].includes(current)) return res.status(400).json({ error: 'Can only cancel pending or taken jobs' });
        await sql`UPDATE service_requests SET status = 'cancelled', updated_at = NOW() WHERE id = ${jobId}`;
        // notify assigned provider if present
        try {
          if (existing.assigned_provider_id) {
            await sql`INSERT INTO notifications (user_id, type, payload) VALUES (${existing.assigned_provider_id}, 'job_status', ${sql.json({ jobId, status: 'cancelled', by: userId, role: 'customer' })})`;
          }
        } catch (nerr) {
          console.error('Failed to create notification for customer cancellation:', nerr);
        }
        return res.json({ message: 'Job cancelled' });
      }
      return res.status(400).json({ error: 'Unsupported customer transition' });
    }

    return res.status(403).json({ error: 'Not allowed to change job status' });
  } catch (err) {
    console.error('Error updating job status (generic):', err);
    res.status(500).json({ error: 'Failed to update job status' });
  }
});

// Provider — post an update (message/image) about a job; creates notification for customer
app.post('/provider/jobs/:id/updates', requireAuth, requireProvider, upload.single('image'), async (req, res) => {
  const jobId = Number.parseInt(req.params.id, 10);
  let { message, imageUrl } = req.body || {};

  // if a file was uploaded, construct a public URL
  if (req.file && req.file.filename) {
    const publicPath = `/uploads/${req.file.filename}`;
    imageUrl = publicPath;
  }

  if (Number.isNaN(jobId)) return res.status(400).json({ error: 'Invalid job id' });

  try {
    await ensureServiceRequestSchema();
    const [job] = await sql`SELECT id, customer_id, assigned_provider_id FROM service_requests WHERE id = ${jobId}`;
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.assigned_provider_id !== req.user.id) return res.status(403).json({ error: 'Only assigned provider can post updates' });

    const result = await sql`
      INSERT INTO job_updates (service_request_id, provider_id, message, image_url)
      VALUES (${jobId}, ${req.user.id}, ${message}, ${imageUrl})
      RETURNING id, service_request_id, provider_id, message, image_url, created_at
    `;

    // create notification for customer
    await sql`
      INSERT INTO notifications (user_id, type, payload)
      VALUES (
        ${job.customer_id},
        'job_update',
        ${sql.json({ jobId, message, imageUrl })}
      )
    `;

    res.json(result[0]);
  } catch (err) {
    console.error('Error posting job update:', err);
    res.status(500).json({ error: 'Failed to post update' });
  }
});

// Provider — list jobs assigned to this provider (taken/ongoing/paused)
app.get('/provider/my-jobs', requireAuth, requireProvider, async (req, res) => {
  try {
    await ensureServiceRequestSchema();
    const providerId = req.user.id;
    console.log('providerId (type):', typeof providerId, providerId);
    const jobs = await sql`
      SELECT
        sr.id,
          sr.title,
          sr.category,
          sr.description,
          sr.preferred_date,
          sr.preferred_timezone,
          sr.status,
          sr.created_at,
          sr.assigned_provider_id,
          u.name AS customer_name,
          u.email AS customer_email,
          u.phone AS customer_phone
      FROM service_requests sr
      JOIN users u ON u.id = sr.customer_id
      WHERE sr.assigned_provider_id = ${providerId} AND sr.status IN ('taken','ongoing','paused','done')
      ORDER BY sr.created_at DESC
    `;

    const ids = jobs.map(j => j.id);
    let updates = [];
    if (ids.length) {
      // fetch updates per id to avoid array-typing issues with the postgres client
      for (const sid of ids) {
        const rows = await sql`SELECT * FROM job_updates WHERE service_request_id = ${sid} ORDER BY created_at ASC`;
        updates = updates.concat(rows);
      }
    }

    // fetch invoices for these service requests (latest first)
    let invoices = [];
    if (ids.length) {
      for (const sid of ids) {
        const invRows = await sql`SELECT * FROM invoices WHERE service_request_id = ${sid} ORDER BY created_at DESC`;
        invoices = invoices.concat(invRows);
      }
    }

    const serializeDate = (value) => {
      if (!value) return null;
      if (value instanceof Date) return value.toISOString();
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
    };

    res.json(jobs.map((request) => ({
      id: request.id,
      title: request.title,
      category: request.category,
      description: request.description,
      preferredDate: serializeDate(request.preferred_date),
      preferredTimezone: request.preferred_timezone || null,
      status: request.status,
      createdAt: serializeDate(request.created_at),
      customerName: request.customer_name || '',
      customerEmail: request.customer_email || '',
      customerPhone: request.customer_phone || '',
      assignedToMe: request.assigned_provider_id === providerId,
      updates: updates.filter(u => u.service_request_id === request.id).map(u => ({ id: u.id, message: u.message, imageUrl: u.image_url, createdAt: serializeDate(u.created_at) })),
      invoices: invoices.filter(i => i.service_request_id === request.id).map(i => ({ id: i.id, amount: Number(i.amount ?? i.total_amount), currency: i.currency, notes: i.notes, paid: i.paid, createdAt: serializeDate(i.created_at), paidAt: serializeDate(i.paid_at) }))
    })));
  } catch (err) {
    console.error('Error fetching my jobs:', err);
    res.status(500).json({ error: 'Failed to fetch my jobs' });
  }
});

// Notifications for the authenticated user
app.get('/notifications', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const rows = await sql`SELECT id, type, payload, read, created_at FROM notifications WHERE user_id = ${userId} ORDER BY created_at DESC`;
    res.json(rows.map(r => ({ id: r.id, type: r.type, payload: r.payload, read: r.read, createdAt: r.created_at }))); 
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Create an invoice for a completed job (provider creates invoice for their customer)
app.post('/invoices', requireAuth, requireProvider, async (req, res) => {
  try {
    await ensureServiceRequestSchema();
    const providerId = req.user.id;
    const { serviceRequestId, amount, currency = 'USD', notes = '' } = req.body || {};
    const srId = Number.parseInt(serviceRequestId, 10);
    if (Number.isNaN(srId) || !amount) return res.status(400).json({ error: 'Missing serviceRequestId or amount' });

    const [job] = await sql`SELECT id, customer_id, assigned_provider_id, status FROM service_requests WHERE id = ${srId}`;
    if (!job) return res.status(404).json({ error: 'Service request not found' });
    if (job.assigned_provider_id !== providerId) return res.status(403).json({ error: 'Only assigned provider can create invoice' });
    if ((job.status || '').toLowerCase() !== 'done') return res.status(400).json({ error: 'Invoice can only be created for completed jobs' });

    const inserted = await sql`
      INSERT INTO invoices (service_request_id, provider_id, customer_id, amount, total_amount, currency, notes)
      VALUES (${srId}, ${providerId}, ${job.customer_id}, ${amount}, ${amount}, ${currency}, ${notes})
      RETURNING id, service_request_id, provider_id, customer_id, COALESCE(amount, total_amount) AS amount, currency, notes, paid, created_at
    `;

    const invoice = inserted[0];

    // create notification for customer (include PDF URL path)
    try {
      const pdfPath = `/invoices/${invoice.id}/pdf`;
      await sql`INSERT INTO notifications (user_id, type, payload) VALUES (${job.customer_id}, 'invoice', ${sql.json({ invoiceId: invoice.id, serviceRequestId: srId, amount: Number(invoice.amount), currency: invoice.currency, notes, pdfPath })})`;
    } catch (nerr) {
      console.error('Failed to create invoice notification:', nerr);
    }

    res.status(201).json({ invoice });
  } catch (err) {
    console.error('Error creating invoice:', err);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// List invoices for the authenticated user (provider sees invoices they issued, customer sees invoices for them)
app.get('/invoices', requireAuth, async (req, res) => {
  try {
    await ensureServiceRequestSchema();
    const userId = req.user.id;
    const role = (req.user.role || '').toLowerCase();

    let rows = [];
    if (role === 'provider') {
      rows = await sql`SELECT i.*, sr.title as service_title FROM invoices i LEFT JOIN service_requests sr ON sr.id = i.service_request_id WHERE i.provider_id = ${userId} ORDER BY i.created_at DESC`;
    } else if (role === 'customer') {
      rows = await sql`SELECT i.*, sr.title as service_title FROM invoices i LEFT JOIN service_requests sr ON sr.id = i.service_request_id WHERE i.customer_id = ${userId} ORDER BY i.created_at DESC`;
    } else if (role === 'admin') {
      rows = await sql`SELECT i.*, sr.title as service_title FROM invoices i LEFT JOIN service_requests sr ON sr.id = i.service_request_id ORDER BY i.created_at DESC`;
    } else {
      // default: return invoices where user is either provider or customer
      rows = await sql`SELECT i.*, sr.title as service_title FROM invoices i LEFT JOIN service_requests sr ON sr.id = i.service_request_id WHERE i.customer_id = ${userId} OR i.provider_id = ${userId} ORDER BY i.created_at DESC`;
    }

    const serializeDate = (v) => (v ? (v instanceof Date ? v.toISOString() : String(v)) : null);
    res.json(rows.map(r => ({ id: r.id, serviceRequestId: r.service_request_id, serviceTitle: r.service_title || '', providerId: r.provider_id, customerId: r.customer_id, amount: Number(r.amount), currency: r.currency, notes: r.notes, paid: r.paid, paidAt: serializeDate(r.paid_at), createdAt: serializeDate(r.created_at) })));
  } catch (err) {
    console.error('Error fetching invoices:', err);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// Mark invoice as paid
app.put('/invoices/:id/pay', requireAuth, async (req, res) => {
  try {
    const invoiceId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(invoiceId)) return res.status(400).json({ error: 'Invalid invoice id' });

    // fetch invoice
    const [inv] = await sql`SELECT id, provider_id, customer_id, paid FROM invoices WHERE id = ${invoiceId}`;
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });

    const userId = req.user.id;
    const role = (req.user.role || '').toLowerCase();

    // only customer (invoice recipient) or admin can mark as paid, or provider (if they accept marking themselves)
    if (role === 'customer' && inv.customer_id !== userId) return res.status(403).json({ error: 'Not allowed' });
    if (role === 'provider' && inv.provider_id !== userId) return res.status(403).json({ error: 'Not allowed' });

    if (inv.paid) return res.status(400).json({ error: 'Invoice already marked as paid' });

    const updated = await sql`
      UPDATE invoices SET paid = true, paid_at = NOW() WHERE id = ${invoiceId} RETURNING id, service_request_id, provider_id, customer_id, amount, currency, notes, paid, paid_at, created_at
    `;

    const updatedInv = updated[0];

    // notify provider that invoice was paid (if provider exists)
    try {
      if (updatedInv.provider_id) {
        await sql`INSERT INTO notifications (user_id, type, payload) VALUES (${updatedInv.provider_id}, 'invoice_paid', ${sql.json({ invoiceId: updatedInv.id, serviceRequestId: updatedInv.service_request_id, amount: Number(updatedInv.amount) })})`;
      }
    } catch (nerr) {
      console.error('Failed to create invoice_paid notification:', nerr);
    }

    res.json({ invoice: updatedInv });
  } catch (err) {
    console.error('Error marking invoice paid:', err);
    res.status(500).json({ error: 'Failed to mark invoice paid' });
  }
});

// Debug helper: mark invoice paid via a simple GET link for local testing.
// Enabled only when INVOICE_DEBUG_ENABLED=true. Optionally protect with INVOICE_DEBUG_SECRET.
app.get('/debug/pay-invoice/:id', async (req, res) => {
  try {
    if (process.env.INVOICE_DEBUG_ENABLED !== 'true') return res.status(404).send('Not found');
    const secret = process.env.INVOICE_DEBUG_SECRET;
    if (secret) {
      if (!req.query.secret || req.query.secret !== secret) return res.status(403).send('Forbidden');
    }

    const invoiceId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(invoiceId)) return res.status(400).send('Invalid invoice id');

    // mark invoice paid
    const updated = await sql`UPDATE invoices SET paid = true, paid_at = NOW() WHERE id = ${invoiceId} RETURNING id, service_request_id, provider_id, customer_id, amount`;
    if (!updated || updated.length === 0) return res.status(404).send('Invoice not found');
    const inv = updated[0];

    // notify provider
    try {
      if (inv.provider_id) await sql`INSERT INTO notifications (user_id, type, payload) VALUES (${inv.provider_id}, 'invoice_paid', ${sql.json({ invoiceId: inv.id, serviceRequestId: inv.service_request_id, amount: Number(inv.amount) })})`;
    } catch (nerr) {
      console.error('Failed to create invoice_paid notification (debug):', nerr);
    }

    res.json({ invoice: inv, message: 'Marked paid (debug)' });
  } catch (err) {
    console.error('Debug pay-invoice failed:', err);
    res.status(500).json({ error: 'Failed to mark invoice paid' });
  }
});

// Create a Stripe Checkout session for an invoice (if Stripe configured)
app.post('/invoices/:id/create-checkout', requireAuth, async (req, res) => {
  const invoiceId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(invoiceId)) return res.status(400).json({ error: 'Invalid invoice id' });

  // fetch invoice and validate access
  const [inv] = await sql`SELECT id, amount, currency, customer_id FROM invoices WHERE id = ${invoiceId}`;
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });

  // Only allow the invoice customer, assigned provider, or admin to create a checkout session
  const userId = req.user.id;
  const role = (req.user.role || '').toLowerCase();
  if (role === 'customer' && inv.customer_id !== userId) return res.status(403).json({ error: 'Not allowed' });
  if (role === 'provider' && inv.provider_id !== userId) return res.status(403).json({ error: 'Not allowed' });

  // NOTE (PAY NOT WORKING):
  // - Known issue: customers clicking "Pay" or providers requesting "Get Pay Link" may see failures
  //   when Stripe is not configured locally. To enable real Stripe Checkout you MUST set
  //   `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` and expose your local server to the
  //   internet (e.g., via ngrok) so Stripe can call the webhook.
  // - For local development we return a `debugUrl` when `INVOICE_DEBUG_ENABLED=true` which
  //   points to `/debug/pay-invoice/:id`. Use the debug URL to mark invoices paid during demos.
  // - If pay flows report errors, check backend logs for Stripe errors and confirm env vars.

  // dynamic import of stripe so app still runs without stripe package installed
  try {
    const StripeModule = await import('stripe');
    const Stripe = StripeModule.default;
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      // If Stripe is not configured, but debug-pay is enabled, return a debug URL
      if (process.env.INVOICE_DEBUG_ENABLED === 'true') {
        const secret = process.env.INVOICE_DEBUG_SECRET ? `?secret=${encodeURIComponent(process.env.INVOICE_DEBUG_SECRET)}` : '';
        const base = process.env.API_BASE_URL || `http://localhost:${PORT}`;
        const debugUrl = `${base}/debug/pay-invoice/${invoiceId}${secret}`;
        return res.status(200).json({ debugUrl, message: 'Stripe not configured; returning debug pay URL' });
      }
      return res.status(501).json({ error: 'Stripe not configured (STRIPE_SECRET_KEY missing)' });
    }
    const stripe = Stripe(stripeKey);

    const successUrl = `${process.env.STRIPE_SUCCESS_URL || 'http://localhost:3000'}/`; // could be customized
    const cancelUrl = `${process.env.STRIPE_CANCEL_URL || 'http://localhost:3000'}/`;

    // amount in smallest currency unit (cents)
    const amount = Math.round(Number(inv.amount) * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{ price_data: { currency: inv.currency || 'usd', product_data: { name: `Invoice #${inv.id}` }, unit_amount: amount }, quantity: 1 }],
      customer_email: null,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { invoiceId: String(inv.id) }
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout creation failed:', err);
    return res.status(501).json({ error: 'Stripe not available or misconfigured' });
  }
});

// Stripe webhook endpoint to mark invoices paid when checkout completes
app.post('/stripe/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (webhookSecret) {
      const StripeModule = await import('stripe');
      const Stripe = StripeModule.default;
      const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
      const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
      event = stripe.webhooks.constructEvent(raw, sig, webhookSecret);
    } else {
      // If no webhook secret provided, accept parsed body (less secure)
      event = req.body;
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message || err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const invoiceId = session.metadata && session.metadata.invoiceId ? Number.parseInt(session.metadata.invoiceId, 10) : null;
    if (invoiceId) {
      try {
        const updated = await sql`UPDATE invoices SET paid = true, paid_at = NOW() WHERE id = ${invoiceId} RETURNING id, provider_id, customer_id, amount`;
        if (updated.length) {
          const inv = updated[0];
          if (inv.provider_id) {
            await sql`INSERT INTO notifications (user_id, type, payload) VALUES (${inv.provider_id}, 'invoice_paid', ${sql.json({ invoiceId: inv.id, amount: Number(inv.amount) })})`;
          }
        }
      } catch (err) {
        console.error('Failed to mark invoice paid via webhook:', err);
      }
    }
  }

  res.json({ received: true });
});

// Generate a PDF for an invoice (requires auth) and stream it back
app.get('/invoices/:id/pdf', requireAuth, async (req, res) => {
  try {
    const invoiceId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(invoiceId)) return res.status(400).json({ error: 'Invalid invoice id' });

    const rows = await sql`SELECT i.*, sr.title as service_title, p.name as provider_name, p.email as provider_email, c.name as customer_name, c.email as customer_email FROM invoices i LEFT JOIN service_requests sr ON sr.id = i.service_request_id LEFT JOIN users p ON p.id = i.provider_id LEFT JOIN users c ON c.id = i.customer_id WHERE i.id = ${invoiceId}`;
    const inv = rows[0];
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });

    const userId = req.user.id;
    const role = (req.user.role || '').toLowerCase();
    if (role === 'customer' && inv.customer_id !== userId) return res.status(403).json({ error: 'Not allowed' });
    if (role === 'provider' && inv.provider_id !== userId) return res.status(403).json({ error: 'Not allowed' });

    // dynamic import of pdfkit so server can run without the package installed
    let PDFDocument;
    try {
      const pdfMod = await import('pdfkit');
      PDFDocument = pdfMod.default || pdfMod;
    } catch (err) {
      console.error('pdfkit not available:', err);
      return res.status(501).json({ error: 'PDF generation not available (missing dependency)' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${inv.id}.pdf`);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    doc.fontSize(20).text('Invoice', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`Invoice ID: ${inv.id}`);
    doc.text(`Date: ${new Date(inv.created_at).toLocaleString()}`);
    doc.moveDown();

    doc.fontSize(14).text('Provider', { underline: true });
    doc.fontSize(12).text(`${inv.provider_name || ''} (${inv.provider_email || ''})`);
    doc.moveDown();

    doc.fontSize(14).text('Customer', { underline: true });
    doc.fontSize(12).text(`${inv.customer_name || ''} (${inv.customer_email || ''})`);
    doc.moveDown();

    doc.fontSize(14).text('Service Request', { underline: true });
    doc.fontSize(12).text(`${inv.service_title || `Request #${inv.service_request_id}`}`);
    doc.moveDown();

    doc.fontSize(14).text('Summary / Notes', { underline: true });
    doc.fontSize(12).text(inv.notes || '');
    doc.moveDown();

    doc.fontSize(14).text('Amount', { underline: true });
    doc.fontSize(12).text(`${inv.currency || 'USD'} ${Number(inv.amount).toFixed(2)}`);
    doc.moveDown();

    doc.fontSize(12).text('Status: ' + (inv.paid ? `Paid at ${inv.paid_at}` : 'Unpaid'));

    doc.end();
  } catch (err) {
    console.error('Error generating invoice PDF:', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

app.put('/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const userId = req.user.id;
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    await sql`UPDATE notifications SET read = true WHERE id = ${id} AND user_id = ${userId}`;
    res.json({ message: 'Marked read' });
  } catch (err) {
    console.error('Error marking notification read:', err);
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

// ✅ Public (authenticated) list of providers for customers to browse
app.get('/providers', requireAuth, async (req, res) => {
  try {
    await ensureProviderSchema();

    const qRaw = typeof req.query?.q === 'string' ? req.query.q.trim() : '';
    const q = qRaw.length ? `%${qRaw}%` : null;

    const providers = q
      ? await sql`
          SELECT
            u.id,
            u.name,
            u.email,
            u.photo_url,
            u.phone,
            pp.company_name,
            pp.skills,
            pp.hourly_rate,
            pp.bio
          FROM users u
          LEFT JOIN provider_profiles pp ON pp.user_id = u.id
          WHERE LOWER(u.role) = 'provider'
            AND (u.status IS NULL OR LOWER(u.status) = 'active')
            AND (
              LOWER(u.name) LIKE LOWER(${q}) OR
              LOWER(COALESCE(pp.company_name, '')) LIKE LOWER(${q}) OR
              LOWER(COALESCE(pp.skills::text, '')) LIKE LOWER(${q})
            )
          ORDER BY u.id DESC
        `
      : await sql`
          SELECT
            u.id,
            u.name,
            u.email,
            u.photo_url,
            u.phone,
            pp.company_name,
            pp.skills,
            pp.hourly_rate,
            pp.bio
          FROM users u
          LEFT JOIN provider_profiles pp ON pp.user_id = u.id
          WHERE LOWER(u.role) = 'provider' AND (u.status IS NULL OR LOWER(u.status) = 'active')
          ORDER BY u.id DESC
        `;

    const mapped = providers.map((p) => {
      const [firstName = '', ...rest] = typeof p.name === 'string' ? p.name.trim().split(/\s+/) : [''];
      const lastName = rest.join(' ');
      let skills = [];
      if (Array.isArray(p.skills)) skills = p.skills;
      else if (typeof p.skills === 'string' && p.skills.length) {
        try { skills = JSON.parse(p.skills); } catch { skills = p.skills.split(',').map(s => s.trim()); }
      }

      return {
        id: p.id,
        firstName,
        lastName,
        email: p.email || '',
        photoUrl: p.photo_url || null,
        phone: p.phone || '',
        company: p.company_name || '',
        skills,
        hourlyRate: p.hourly_rate ? Number(p.hourly_rate) : null,
        bio: p.bio || ''
      };
    });

    res.json(mapped);
  } catch (err) {
    console.error('Error fetching providers list:', err);
    res.status(500).json({ error: 'Failed to fetch providers' });
  }
});

// ✅ Get all service requests for logged-in customer
app.get("/service-requests/my-requests", requireAuth, async (req, res) => {
  const customerId = req.user.id;

  try {
    await ensureServiceRequestSchema();

    const requests = await sql`
      SELECT * FROM service_requests 
      WHERE customer_id = ${customerId}
      ORDER BY created_at DESC
    `;

    const serializeDate = (value) => {
      if (!value) return null;
      if (value instanceof Date) return value.toISOString();
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
    };

    res.json(
      requests.map((request) => ({
        ...request,
        preferred_date: serializeDate(request.preferred_date),
        preferred_timezone: request.preferred_timezone || null,
        created_at: serializeDate(request.created_at),
        updated_at: serializeDate(request.updated_at),
      }))
    );
  } catch (err) {
    console.error("Error fetching service requests:", err);
    res.status(500).json({ error: "Failed to fetch service requests" });
  }
});

// ✅ Cancel service request
app.delete("/service-requests/:id", requireAuth, async (req, res) => {
  const requestId = Number.parseInt(req.params.id, 10);
  const userId = req.user.id;

  if (Number.isNaN(requestId)) {
    return res.status(400).json({ error: "Invalid request ID" });
  }

  try {
    await ensureServiceRequestSchema();

    const result = await sql`
      UPDATE service_requests
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = ${requestId} AND customer_id = ${userId} AND status = 'pending'
      RETURNING *
      `;

    if (result.length === 0) {
      return res.status(404).json({ 
        error: "Request not found or cannot be cancelled" 
      });
    }

    const serializeDate = (value) => {
      if (!value) return null;
      if (value instanceof Date) return value.toISOString();
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
    };

    const request = result[0];

    res.json({
      message: "Service request cancelled successfully",
      request: {
        ...request,
        preferred_date: serializeDate(request?.preferred_date),
        preferred_timezone: request?.preferred_timezone || null,
        created_at: serializeDate(request?.created_at),
        updated_at: serializeDate(request?.updated_at),
      }
    });
  } catch (err) {
    console.error("Error cancelling service request:", err);
    res.status(500).json({ error: "Failed to cancel service request" });
  }
});

// ✅ Edit (update) a service request — only allowed while request is pending and by owner
app.patch('/service-requests/:id', requireAuth, async (req, res) => {
  const requestId = Number.parseInt(req.params.id, 10);
  const userId = req.user.id;

  if (Number.isNaN(requestId)) return res.status(400).json({ error: 'Invalid request id' });

  try {
    await ensureServiceRequestSchema();

    const [existing] = await sql`SELECT * FROM service_requests WHERE id = ${requestId}`;
    if (!existing) return res.status(404).json({ error: 'Service request not found' });

    if (existing.customer_id !== userId) return res.status(403).json({ error: 'Only the owner can edit this request' });

    // Only allow edits when status is pending
    const currentStatus = (existing.status || 'pending').toLowerCase();
    if (currentStatus !== 'pending') {
      return res.status(403).json({ error: 'Edits allowed only while request status is pending' });
    }

    const { title, category, description, preferred_date, preferred_timezone, updated_at } = req.body || {};

    // Optional optimistic concurrency: if client supplied updated_at, enforce it hasn't changed
    if (typeof updated_at !== 'undefined' && updated_at !== null) {
      const existingUpdated = existing.updated_at ? new Date(existing.updated_at).toISOString() : null;
      if (existingUpdated !== updated_at) {
        return res.status(409).json({ error: 'Request changed since you started editing' });
      }
    }

    // Determine new values (preserve existing when field not provided)
    const newTitle = typeof title === 'undefined' ? existing.title : (String(title || '').trim());
    const newCategory = typeof category === 'undefined' ? existing.category : (String(category || '').trim());
    const newDescription = typeof description === 'undefined' ? existing.description : (String(description || '').trim());

    // Validate required fields
    if (!newTitle) return res.status(400).json({ error: 'Title is required' });
    if (!newCategory) return res.status(400).json({ error: 'Category is required' });
    if (!newDescription) return res.status(400).json({ error: 'Description is required' });

    let newPreferredDate = existing.preferred_date;
    if (typeof preferred_date !== 'undefined') {
      if (preferred_date === null || preferred_date === '') {
        newPreferredDate = null;
      } else {
        const parsed = new Date(preferred_date);
        if (Number.isNaN(parsed.getTime())) return res.status(400).json({ error: 'Invalid preferred_date format' });
        newPreferredDate = parsed.toISOString();
      }
    }

    const newPreferredTz = typeof preferred_timezone === 'undefined' ? existing.preferred_timezone : (preferred_timezone || null);

    const updated = await sql`
      UPDATE service_requests
      SET title = ${newTitle},
          category = ${newCategory},
          description = ${newDescription},
          preferred_date = ${newPreferredDate},
          preferred_timezone = ${newPreferredTz},
          updated_at = NOW()
      WHERE id = ${requestId}
      RETURNING *
    `;

    const updatedRequest = updated[0];

    const serializeDate = (value) => {
      if (!value) return null;
      if (value instanceof Date) return value.toISOString();
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
    };

    res.json({ message: 'Service request updated', request: { ...updatedRequest, preferred_date: serializeDate(updatedRequest.preferred_date), preferred_timezone: updatedRequest.preferred_timezone || null, created_at: serializeDate(updatedRequest.created_at), updated_at: serializeDate(updatedRequest.updated_at) } });
  } catch (err) {
    console.error('Error updating service request:', err);
    res.status(500).json({ error: 'Failed to update service request' });
  }
});

//Automatically delete requests that have been cancelled for >=24 hours
async function cleanUpCancelledRequests() {
  try {
    const result = await sql`
      DELETE FROM service_requests
      WHERE status = 'closed'
      AND updated_at <= NOW() - INTERVAL '24 hours'
      RETURNING id, title
    `;

    if (result.length > 0) {
      console.log(`🧹 Auto-deleted ${result.length} cancelled service request(s):`);
      result.forEach(r => console.log(`   • ID ${r.id} – ${r.title || "Untitled"}`));
    }
  } catch (err) {
    console.error("❌ Failed to clean up cancelled service requests:", err);
  }
}

// Run cleanup every hour (3 600 000 ms)
setInterval(cleanUpCancelledRequests, 3600000);

// Optionally run once on startup
cleanUpCancelledRequests();

// ✅ Start the server
app.listen(PORT, () => console.log(`🚀 API running on http://localhost:${PORT}`));
