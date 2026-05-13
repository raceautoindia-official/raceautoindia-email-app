import mysql from "mysql2/promise";

// Backwards-compatible: env vars take precedence, but fall back to legacy values
// so existing deployments keep working until .env is configured.
const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "race_user",
  database: process.env.DB_NAME || "bulk_email",
  password: process.env.DB_PASSWORD || "race@123",
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 20,
  queueLimit: Number(process.env.DB_QUEUE_LIMIT) || 200,
  maxIdle: 10,
  idleTimeout: 60000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 10000,
});

export default db;
