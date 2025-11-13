// repairconnect-backend/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import sql from "./db.js"; // ✅ Supabase-style import

const app = express();

// pull values from .env
const { ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET } = process.env;
const PORT = process.env.PORT || 8081;

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json({ limit: "10mb" }));

// ✅ Public root route (for testing)
app.get("/", (req, res) => {
  console.log("GET / hit ✅");
  res.send("Backend is working!");
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
      completedJobs: 0,
      newMessages: 0,
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
            u.email AS customer_email
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
            u.email AS customer_email
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
        };
      })
    );
  } catch (err) {
    console.error("Error fetching provider jobs:", err);
    res.status(500).json({ error: "Failed to fetch service requests" });
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

//Automatically delete requests that have been cancelled for >=24 hours
async function cleanUpCancelledRequests() {
  try {
    const result = await sql`
      DELETE FROM service_requests
      WHERE status = 'cancelled'
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
