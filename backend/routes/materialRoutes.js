import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { MaterialController } from '../controllers/materialController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/rbacMiddleware.js';
import { createSafeFileFilter, verifyUploadedFileMiddleware } from '../utils/fileValidator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../uploads/materiales');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ALLOWED_MATERIAL_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel'
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    cb(null, `mat_${cleanName}_${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // Máximo 25 MB por material
  fileFilter: createSafeFileFilter(
    ALLOWED_MATERIAL_MIMES,
    null,
    'Formato no permitido. Solo se aceptan PDFs, imágenes (PNG/JPEG/WEBP) o documentos Word/Excel.'
  )
});

const router = Router();

// Rutas protegidas para personal clínico y administrativo
router.use(authMiddleware);
router.use(requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION']));

// Carpetas de materiales
router.get('/folders', MaterialController.getFolders);
router.get('/folders/:id', MaterialController.getFolderById);
router.post('/folders', MaterialController.createFolder);
router.put('/folders/:id', MaterialController.updateFolder);
router.delete('/folders/:id', MaterialController.deleteFolder);

// Archivos de materiales
router.get('/folders/:folderId/files', MaterialController.getFiles);
router.post('/upload', upload.single('archivo'), verifyUploadedFileMiddleware(ALLOWED_MATERIAL_MIMES), MaterialController.uploadFile);
router.delete('/files/:id', MaterialController.deleteFile);
router.post('/files/:id/download', MaterialController.recordDownload);

export default router;
