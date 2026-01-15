
 //@file uploadRoutes.js
 //@description Rutas para el sistema de subida de archivos grandes
 

const express = require('express');
const router = express.Router();

// Importar middlewares.
const {
  validateInitiateUpload,
  validateChunkUpload,
  validateCompleteUpload,
  handleMulterError,
  upload
} = require('../middleware/uploadMiddleware');

// Importar controladores.
const {
  initiateUpload,
  uploadChunk,
  completeUpload,
  getUploadProgress,
  cancelUpload
} = require('../controllers/uploadController');

// Ruta para iniciar subida.
router.post(
  '/initiate',
  validateInitiateUpload,
  initiateUpload
);

// Ruta para subir chunk.
router.post(
  '/chunk',
  upload.single('chunk'),
  handleMulterError,
  validateChunkUpload,
  uploadChunk
);

// Ruta para completar subida.
router.post(
  '/complete',
  validateCompleteUpload,
  completeUpload
);

// Ruta para obtener progreso.
router.get(
  '/progress/:sessionId',
  getUploadProgress
);

// Ruta para cancelar subida.
router.delete(
  '/:sessionId',
  cancelUpload
);

// Rutas de desarrollo (solo desarrollo).
if (process.env.NODE_ENV === 'development') {
  // Listar sesiones activas
  router.get('/list-sessions', (req, res) => {
    const fs = require('fs-extra');
    const path = require('path');
    const CHUNK_DIR = process.env.CHUNK_DIR || './uploads/chunks';

    try {
      if (!fs.existsSync(CHUNK_DIR)) {
        return res.json({ sessions: [] });
      }

      const sessions = fs.readdirSync(CHUNK_DIR)
        .map(sessionId => {
          const sessionPath = path.join(CHUNK_DIR, sessionId);
          const stats = fs.statSync(sessionPath);
          const chunks = fs.readdirSync(sessionPath);
          
          return {
            sessionId,
            createdAt: stats.birthtime,
            chunkCount: chunks.length,
            size: chunks.reduce((total, chunk) => {
              return total + fs.statSync(path.join(sessionPath, chunk)).size;
            }, 0)
          };
        });

      res.json({ 
        totalSessions: sessions.length,
        sessions 
      });
    } catch (error) {
      console.error('Error listando sesiones:', error);
      res.status(500).json({ 
        message: 'Error obteniendo sesiones'
      });
    }
  });

  // Limpiar chunks caducados.
  router.get('/cleanup-expired', (req, res) => {
    const fs = require('fs-extra');
    const path = require('path');
    const CHUNK_DIR = process.env.CHUNK_DIR || './uploads/chunks';
    const CHUNK_EXPIRY_HOURS = parseInt(process.env.CHUNK_EXPIRY_HOURS) || 24;

    try {
      if (!fs.existsSync(CHUNK_DIR)) {
        return res.json({ 
          deletedSessions: 0,
          deletedChunks: 0,
          totalFreed: 0
        });
      }

      const now = Date.now();
      const sessions = fs.readdirSync(CHUNK_DIR);
      let deletedSessions = 0;
      let deletedChunks = 0;
      let totalFreed = 0;

      sessions.forEach(sessionId => {
        const sessionPath = path.join(CHUNK_DIR, sessionId);
        const stats = fs.statSync(sessionPath);
        const ageHours = (now - stats.birthtime.getTime()) / (1000 * 60 * 60);

        if (ageHours > CHUNK_EXPIRY_HOURS) {
          const chunks = fs.readdirSync(sessionPath);
          const sessionSize = chunks.reduce((total, chunk) => {
            return total + fs.statSync(path.join(sessionPath, chunk)).size;
          }, 0);
          
          fs.removeSync(sessionPath);
          deletedSessions++;
          deletedChunks += chunks.length;
          totalFreed += sessionSize;
        }
      });

      res.json({
        deletedSessions,
        deletedChunks,
        totalFreed: formatBytes(totalFreed),
        message: `Limpieza completada: ${deletedSessions} sesiones eliminadas`
      });
    } catch (error) {
      console.error('Error en cleanup:', error);
      res.status(500).json({ 
        message: 'Error limpiando chunks expirados'
      });
    }
  });
}

// Función auxiliar para formatear bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

module.exports = router;