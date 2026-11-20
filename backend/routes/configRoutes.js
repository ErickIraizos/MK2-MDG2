import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ConfigController } from '../controllers/configController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/rbacMiddleware.js';
import { validateBody, Validators } from '../middlewares/validationMiddleware.js';
import { createSafeFileFilter, verifyUploadedFileMiddleware } from '../utils/fileValidator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FACILITY_UPLOAD_DIR = path.resolve(__dirname, '../uploads/instalaciones');

if (!fs.existsSync(FACILITY_UPLOAD_DIR)) {
  fs.mkdirSync(FACILITY_UPLOAD_DIR, { recursive: true });
}

const ALLOWED_FACILITY_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

const facilityStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, FACILITY_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    cb(null, `facility_${uniqueSuffix}${ext}`);
  }
});

const facilityUpload = multer({
  storage: facilityStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: createSafeFileFilter(
    ALLOWED_FACILITY_MIMES,
    null,
    'Formato no permitido. Utilice imágenes en formato JPG, PNG, WEBP o SVG.'
  )
});

const router = Router();

// Validador DTO para actualización de clave Groq
const validateGroqKey = (body) => {
  const errors = {};
  if (!Validators.isNonEmptyString(body.apiKey) || body.apiKey.trim().length < 10) {
    errors.apiKey = 'Debe proporcionar una clave GROQ_API_KEY válida.';
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedData: {
      apiKey: body.apiKey ? body.apiKey.trim() : ''
    }
  };
};

// Pública: datos institucionales y modelos activos
router.get('/public', ConfigController.getPublic);

// Protegidas para Administrador: gestión en caliente y pruebas
router.get('/admin', authMiddleware, requireRole(['ADMIN']), ConfigController.getAllAdmin);
router.put('/groq-key', authMiddleware, requireRole(['ADMIN']), validateBody(validateGroqKey), ConfigController.updateGroqKey);
router.put('/institution', authMiddleware, requireRole(['ADMIN']), ConfigController.updateInstitution);
router.post('/facility-photo', authMiddleware, requireRole(['ADMIN']), facilityUpload.single('foto'), verifyUploadedFileMiddleware(ALLOWED_FACILITY_MIMES), ConfigController.uploadFacilityPhoto);
router.post('/test-groq', authMiddleware, requireRole(['ADMIN']), ConfigController.testGroq);
router.get('/test-groq', authMiddleware, requireRole(['ADMIN']), ConfigController.testGroq);
router.post('/groq-test', authMiddleware, requireRole(['ADMIN']), ConfigController.testGroq);
router.get('/groq-test', authMiddleware, requireRole(['ADMIN']), ConfigController.testGroq);

export default router;
