import express from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/environment.js';
import { DatabaseConnection } from './core/DatabaseConnection.js';
import { PostgresConnection } from './core/PostgresConnection.js';
import { errorHandlerMiddleware } from './middlewares/errorHandlerMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Importar rutas
import authRoutes from './routes/authRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import configRoutes from './routes/configRoutes.js';
import patientRoutes from './routes/patientRoutes.js';
import therapistRoutes from './routes/therapistRoutes.js';
import userRoutes from './routes/userRoutes.js';
import triageRoutes from './routes/triageRoutes.js';
import clinicalRecordRoutes from './routes/clinicalRecordRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import whatsappRoutes from './routes/whatsappRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import consentRoutes from './routes/consentRoutes.js';
import documentReportRoutes from './routes/documentReportRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import batteryRoutes from './routes/batteryRoutes.js';
import convenioRoutes from './routes/convenioRoutes.js';
import glossaryRoutes from './routes/glossaryRoutes.js';
import workshopRoutes from './routes/workshopRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import materialRoutes from './routes/materialRoutes.js';

const app = express();

// 1. Middlewares globales
app.use(compression({
  filter: (req, res) => {
    if (req.headers.accept === 'text/event-stream' || req.path.endsWith('/stream')) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

app.use(cors({
  origin: (origin, callback) => {
    // Permitir peticiones sin origen (móviles, apps locales, curl) o que coincidan con orígenes permitidos
    if (!origin || config.cors.origins.includes(origin) || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(new Error('Bloqueado por política CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Desactivar caché del navegador para endpoints dinámicos de API
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Bloquear acceso estático público a rutas antiguas de /uploads (archivos alojados en Supabase Storage)
app.use('/uploads', (req, res) => {
  return res.status(403).json({
    success: false,
    error: {
      code: 'FORBIDDEN_STATIC_ACCESS',
      message: 'Acceso directo denegado. Los archivos se sirven mediante Supabase Storage o rutas autenticadas de la API.'
    }
  });
});

if (config.env === 'development') {
  app.use(morgan('dev'));
}

// 2. Endpoint de salud (Health Check)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'PSI Aprende Backend API',
    environment: config.env,
    databaseDriver: config.database.driver,
    timestamp: new Date().toISOString()
  });
});

// 3. Montar rutas de API
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/config', configRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/therapists', therapistRoutes);
app.use('/api/users', userRoutes);
app.use('/api/triage', triageRoutes);
app.use('/api/clinical-records', clinicalRecordRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/consents', consentRoutes);
app.use('/api/reports', documentReportRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/inventory', batteryRoutes);
app.use('/api/convenios', convenioRoutes);
app.use('/api/glosario', glossaryRoutes);
app.use('/api/workshops', workshopRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/materials', materialRoutes);

// 4. Manejador de rutas no encontradas (404)
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `La ruta solicitada [${req.method} ${req.originalUrl}] no existe en este servidor.`
    }
  });
});

// 5. Middleware global de manejo de excepciones
app.use(errorHandlerMiddleware);

// 6. Inicialización de base de datos y arranque del servidor
async function startServer() {
  try {
    const isPostgres = config.database.driver === 'postgres' || config.database.driver === 'postgresql';
    if (isPostgres) {
      const info = await PostgresConnection.verifyConnection();
      console.log(`[Database] Conectado exitosamente a PostgreSQL (${info.db}) en zona America/La_Paz`);
    } else {
      DatabaseConnection.getInstance();
    }

    const PORT = config.port;

    app.listen(PORT, () => {
      console.log(`==================================================================`);
      console.log(`[BACKEND] Servidor API REST PSI Aprende en ejecución`);
      console.log(`[SERVER]  URL Base: http://localhost:${PORT}`);
      console.log(`[SERVER]  Health Check: http://localhost:${PORT}/api/health`);
      console.log(`[DATABASE] Motor Activo: ${isPostgres ? 'PostgreSQL (Supabase)' : `SQLite (${config.database.sqlitePath})`}`);
      console.log(`==================================================================`);

      // Auto-restaurar en segundo plano las sesiones vinculadas de WhatsApp
      import('./services/whatsappManager.js').then(({ whatsappManager }) => {
        whatsappManager.autoRestoreConnectedSessions();
      }).catch(e => console.warn('[WhatsApp] Aviso al auto-iniciar sesiones:', e.message));

      // Iniciar el motor de recordatorios automáticos 24h / 2h (Sprint 8 - HU-12)
      import('./services/appointmentSchedulerService.js').then(({ appointmentSchedulerService }) => {
        appointmentSchedulerService.start();
      }).catch(e => console.warn('[Scheduler] Aviso al iniciar motor de recordatorios:', e.message));
    });
  } catch (err) {
    console.error('[ERROR] Error fatal al iniciar el backend:', err);
    process.exit(1);
  }
}

startServer();

export default app;
