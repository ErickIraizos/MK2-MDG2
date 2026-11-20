import fs from 'fs';
import path from 'path';
import { AppError } from '../core/AppError.js';

const MIME_EXT_MAP = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
};

/**
 * Verifica los bytes mágicos (magic bytes) de un Buffer para confirmar su formato binario real.
 */
export function matchesBufferSignature(buf, mimetype) {
  if (!buf || buf.length < 4) return false;

  switch (mimetype) {
    case 'image/png':
      return (
        buf.length >= 8 &&
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47 &&
        buf[4] === 0x0d &&
        buf[5] === 0x0a &&
        buf[6] === 0x1a &&
        buf[7] === 0x0a
      );

    case 'image/jpeg':
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;

    case 'image/webp':
      return (
        buf.length >= 12 &&
        buf.slice(0, 4).toString('ascii') === 'RIFF' &&
        buf.slice(8, 12).toString('ascii') === 'WEBP'
      );

    case 'application/pdf': {
      const head = buf.slice(0, 16).toString('utf8').replace(/^\uFEFF/, '').trimStart();
      return head.startsWith('%PDF-');
    }

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      // OOXML (.docx / .xlsx) son archivos ZIP (PK..)
      return (
        buf[0] === 0x50 &&
        buf[1] === 0x4b &&
        ((buf[2] === 0x03 && buf[3] === 0x04) ||
          (buf[2] === 0x05 && buf[3] === 0x06) ||
          (buf[2] === 0x07 && buf[3] === 0x08))
      );

    case 'application/msword':
    case 'application/vnd.ms-excel':
      // OLE2 Binary (.doc / .xls) o OOXML renombrado
      return (
        (buf.length >= 8 &&
          buf[0] === 0xd0 &&
          buf[1] === 0xcf &&
          buf[2] === 0x11 &&
          buf[3] === 0xe0 &&
          buf[4] === 0xa1 &&
          buf[5] === 0xb1 &&
          buf[6] === 0x1a &&
          buf[7] === 0xe1) ||
        (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04)
      );

    case 'image/svg+xml': {
      const txt = buf.toString('utf8');
      const lower = txt.toLowerCase();
      if (!lower.includes('<svg')) return false;
      // Bloquear vectores XSS embebidos en SVG
      if (/<script[\s>]/i.test(txt) || /\bon[a-z]+\s*=/i.test(txt) || /javascript\s*:/i.test(txt) || /<foreignobject[\s>]/i.test(lower)) {
        return false;
      }
      return true;
    }

    default:
      return false;
  }
}

/**
 * Lee cabecera de archivo en disco y verifica su firma real.
 */
export function verifyFileMagicBytes(filePath, mimetype) {
  if (!filePath || !fs.existsSync(filePath)) return false;

  const isSvg = mimetype === 'image/svg+xml';
  const readSize = isSvg ? 65536 : 32;
  const fd = fs.openSync(filePath, 'r');
  try {
    const stat = fs.fstatSync(fd);
    if (stat.size <= 0) return false;
    const len = Math.min(stat.size, readSize);
    const buffer = Buffer.alloc(len);
    fs.readSync(fd, buffer, 0, len, 0);
    return matchesBufferSignature(buffer, mimetype);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Crea un fileFilter de Multer que valida tanto mimetype como extensión declarada.
 */
export function createSafeFileFilter(allowedMimes, allowedExts = null, customMessage = null) {
  const validExts = allowedExts || allowedMimes.flatMap(m => MIME_EXT_MAP[m] || []);
  return (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mimeOk = allowedMimes.includes(file.mimetype);
    const extOk = validExts.includes(ext);

    if (mimeOk && extOk) {
      cb(null, true);
    } else {
      cb(
        AppError.badRequest(
          customMessage || 'Tipo o extensión de archivo no permitida por seguridad.',
          'INVALID_FILE_TYPE'
        )
      );
    }
  };
}

/**
 * Middleware posterior a Multer: verifica los magic bytes del archivo recién guardado en disco.
 * Si no coincide la firma binaria real, elimina el archivo y responde HTTP 400.
 */
export function verifyUploadedFileMiddleware(allowedMimes, allowedExts = null) {
  const validExts = allowedExts || allowedMimes.flatMap(m => MIME_EXT_MAP[m] || []);

  return (req, res, next) => {
    if (!req.file) return next();

    const ext = path.extname(req.file.originalname || '').toLowerCase();
    const mimetype = req.file.mimetype;
    const filePath = req.file.path;

    const removeTempFile = () => {
      try {
        if (filePath && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {}
    };

    if (!allowedMimes.includes(mimetype) || !validExts.includes(ext)) {
      removeTempFile();
      return next(AppError.badRequest('Tipo o extensión de archivo no permitida.', 'INVALID_FILE_TYPE'));
    }

    const expectedExtsForMime = MIME_EXT_MAP[mimetype] || [];
    if (expectedExtsForMime.length > 0 && !expectedExtsForMime.includes(ext)) {
      removeTempFile();
      return next(AppError.badRequest('La extensión del archivo no coincide con su tipo MIME.', 'INVALID_FILE_SIGNATURE'));
    }

    if (!verifyFileMagicBytes(filePath, mimetype)) {
      removeTempFile();
      return next(
        AppError.badRequest(
          'El archivo subido está corrupto o su contenido binario real no corresponde al formato declarado.',
          'INVALID_FILE_SIGNATURE'
        )
      );
    }

    next();
  };
}

/**
 * Valida una imagen enviada en formato Data URI Base64 (ej. comprobante_base64).
 */
export function validateBase64Image(dataUri, maxBytes = 10 * 1024 * 1024) {
  if (typeof dataUri !== 'string') {
    throw AppError.badRequest('Formato de comprobante base64 inválido.', 'INVALID_FILE_TYPE');
  }
  const match = dataUri.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!match) {
    throw AppError.badRequest('Solo se admiten imágenes PNG, JPEG o WEBP válidas en base64.', 'INVALID_FILE_TYPE');
  }

  const normalizedMime = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  const buf = Buffer.from(match[2], 'base64');
  if (!buf || buf.length === 0 || buf.length > maxBytes) {
    throw AppError.badRequest('La imagen adjunta supera el tamaño máximo permitido o está vacía.', 'INVALID_FILE_SIZE');
  }

  if (!matchesBufferSignature(buf, normalizedMime)) {
    throw AppError.badRequest('El contenido binario de la imagen no es válido.', 'INVALID_FILE_SIGNATURE');
  }

  return normalizedMime;
}
