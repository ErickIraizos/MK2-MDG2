import { AppError } from '../core/AppError.js';
import { config } from '../config/environment.js';

export const errorHandlerMiddleware = (err, req, res, next) => {
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'Ocurrió un error inesperado en el servidor.';
  let details = null;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.errorCode;
    message = err.message;
    details = err.details;
  } else if (err.name === 'MulterError') {
    statusCode = 400;
    errorCode = err.code || 'UPLOAD_ERROR';
    message = err.code === 'LIMIT_FILE_SIZE'
      ? 'El archivo excede el tamaño máximo permitido.'
      : (err.message || 'Error al procesar el archivo adjunto.');
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
    message = 'El token de autenticación es inválido.';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
    message = 'La sesión ha expirado. Inicie sesión nuevamente.';
  } else if (err.code && err.code.startsWith('SQLITE_')) {
    statusCode = 400;
    errorCode = 'DATABASE_ERROR';
    message = 'Error de operación en la base de datos.';
    if (config.env === 'development') {
      details = err.message;
    }
  } else if (config.env === 'development') {
    message = err.message || message;
    details = err.stack;
  }

  // Log en desarrollo
  if (statusCode >= 500) {
    console.error(`[ERROR 500] ${req.method} ${req.url}:`, err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      ...(details ? { details } : {})
    }
  });
};
