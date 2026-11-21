import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno desde backend/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  if (nodeEnv === 'production') {
    throw new Error('[SECURITY FATAL] JWT_SECRET debe estar definido en las variables de entorno en producción.');
  }
  console.warn('[SECURITY WARN] JWT_SECRET no está definido en backend/.env; usando clave de desarrollo local.');
}

const rawDriver = (process.env.DB_DRIVER || process.env.DATABASE_DRIVER || 'sqlite').trim().toLowerCase();

export const config = {
  env: nodeEnv,
  port: parseInt(process.env.PORT, 10) || 3001,
  database: {
    driver: rawDriver,
    sqlitePath: process.env.SQLITE_DB_PATH
      ? path.resolve(__dirname, '..', process.env.SQLITE_DB_PATH)
      : path.resolve(__dirname, '../database/sqlite/psi_aprende.db'),
    postgresUrl: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
    postgresPoolUrl: process.env.DATABASE_URL || process.env.DIRECT_URL || '',
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  },
  jwt: {
    secret: jwtSecret || 'psi_aprende_fallback_secret_key_2026',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  },
  cors: {
    origins: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000').split(',').map(o => o.trim()).filter(Boolean)
  },
  groq: {
    initialApiKey: process.env.GROQ_API_KEY || ''
  }
};
