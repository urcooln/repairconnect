// repairconnect-backend/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import sql from "./db.js"; // ✅ Supabase-style import

const app = express();
const PORT = process.env.PORT || 8081;
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// pull values from .env
app.use(cors());
app.use(express.json());

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
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  next();
}

// ✅ Register new users
app.post("/auth/register", async (req, res) => {
  const { name, email, password, role } = req.body;
  console.log("REGISTER payload:", req.body);

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    // Check if email already exists
    const existing = await sql`
      SELECT id FROM users WHERE email = ${email}
    `;

    if (existing.length > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await sql`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (${name}, ${email}, ${hashedPassword}, ${role})
      RETURNING id, email, role
    `;

    res.json({ message: "User registered", user: result[0] });
  } catch (err) {
    console.error("Registration failed:", err);
    
    // Check for specific database errors
    if (err.code === '23505') { // Unique violation
      return res.status(400).json({ error: "Email already registered" });
    }
    
    if (err.code === '23502') { // Not null violation
      return res.status(400).json({ error: "All fields are required" });
    }
    
    res.status(500).json({ error: err.message || "Registration failed" });
  }
});

// ✅ Customer login (with status check)
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  try {
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

// ✅ Password Reset
app.post("/auth/reset-password", async (req, res) => {
  const { email, newPassword } = req.body || {};

  if (!email || !newPassword) {
    return res.status(400).json({ error: "Email and newPassword are required." });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // NOTE: your DB column is password_hash based on server.js register/login logic
    const result = await sql`
      UPDATE users
      SET password_hash = ${hashedPassword}
      WHERE email = ${email}
      RETURNING id, email;
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

// ✅ Provider routes
app.get("/provider/profile", requireAuth, async (req, res) => {
  try {
    const [provider] = await sql`
      SELECT id, name, email, role
      FROM users
      WHERE id = ${req.user.id} AND role = 'provider'
    `;

    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }

    res.json({
      firstName: provider.name.split(' ')[0],
      lastName: provider.name.split(' ')[1] || '',
      email: provider.email,
      roles: [provider.role],
      completedJobs: 0,
      newMessages: 0
    });
  } catch (err) {
    console.error("Error fetching provider profile:", err);
    res.status(500).json({ error: "Failed to fetch provider profile" });
  }
});

// Test database connection before starting server
async function startServer() {
  try {
    // Test the database connection
    console.log('Testing database connection...');
    const result = await sql`SELECT NOW()`;
    console.log('Database connected successfully:', result[0].now);

    // Start the server
    app.listen(PORT, () => {
      console.log(`🚀 API running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
