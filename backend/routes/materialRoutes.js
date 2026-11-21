import { Router } from 'express';
import multer from 'multer';
import { MaterialController } from '../controllers/materialController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/rbacMiddleware.js';
import { createSafeFileFilter, verifyUploadedFileMiddleware } from '../utils/fileValidator.js';

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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // Máximo 10 MB por material
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
router.get('/files/:id/view', MaterialController.viewFile);
router.post('/upload', upload.single('archivo'), verifyUploadedFileMiddleware(ALLOWED_MATERIAL_MIMES), MaterialController.uploadFile);
router.delete('/files/:id', MaterialController.deleteFile);
router.post('/files/:id/download', MaterialController.recordDownload);

export default router;
