const fileUtils = require('../utils/fileUtils');

const initiateUpload = (req, res) => {
    try {
        const { filename, totalSize } = req.body;
        
        if (!filename || !totalSize) {
            return res.status(400).json({ 
                message: 'Nombre de archivo y tamaño total son requeridos' 
            });
        }
        
        if (!fileUtils.isValidExtension(filename)) {
            return res.status(400).json({ 
                message: 'Tipo de archivo no permitido' 
            });
        }
        
        const maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 * 1024;
        if (totalSize > maxFileSize) {
            return res.status(400).json({ 
                message: `El archivo excede el tamaño máximo de ${maxFileSize / (1024*1024*1024)}GB` 
            });
        }
        
        const sessionId = fileUtils.generateSessionId();
        const totalChunks = fileUtils.calculateTotalChunks(totalSize);
        
        fileUtils.createSessionDirectory(sessionId);
        
        res.status(201).json({
            sessionId,
            filename,
            totalSize,
            totalChunks,
            chunkSize: parseInt(process.env.MAX_CHUNK_SIZE) || 5 * 1024 * 1024,
            message: 'Sesión de upload iniciada correctamente'
        });
    } catch (error) {
        console.error('Error en initiateUpload:', error);
        res.status(500).json({ message: 'Error iniciando upload' });
    }
};

const uploadChunk = (req, res) => {
    try {
        const { sessionId, chunkNumber, totalChunks } = req.body;
        const chunkFile = req.file;
        
        if (!chunkFile) {
            return res.status(400).json({ message: 'No se recibió chunk' });
        }
        
        if (!sessionId || !chunkNumber || !totalChunks) {
            return res.status(400).json({ 
                message: 'sessionId, chunkNumber y totalChunks son requeridos' 
            });
        }
        
        const chunkPath = fileUtils.getChunkPath(sessionId, chunkNumber);
        
        fs.writeFileSync(chunkPath, chunkFile.buffer);
        
        const progress = fileUtils.getUploadProgress(sessionId, totalChunks);
        
        res.json({
            sessionId,
            chunkNumber: parseInt(chunkNumber),
            totalChunks: parseInt(totalChunks),
            progress: progress.percentage,
            uploadedChunks: progress.uploadedChunks,
            message: 'Chunk recibido correctamente'
        });
    } catch (error) {
        console.error('Error en uploadChunk:', error);
        res.status(500).json({ message: 'Error subiendo chunk' });
    }
};

const completeUpload = async (req, res) => {
    try {
        const { sessionId, filename, totalChunks } = req.body;
        
        if (!sessionId || !filename || !totalChunks) {
            return res.status(400).json({ 
                message: 'sessionId, filename y totalChunks son requeridos' 
            });
        }
        
        const progress = fileUtils.getUploadProgress(sessionId, totalChunks);
        
        if (!progress.isComplete) {
            return res.status(400).json({ 
                message: `Faltan chunks por subir: ${progress.uploadedChunks}/${totalChunks}` 
            });
        }
        
        const finalPath = await fileUtils.combineChunks(sessionId, filename);
        const stats = fs.statSync(finalPath);
        
        fileUtils.cleanupChunks(sessionId);
        
        res.json({
            sessionId,
            filename,
            fileUrl: `/uploads/${filename}`,
            fileSize: stats.size,
            message: 'Archivo combinado correctamente'
        });
    } catch (error) {
        console.error('Error en completeUpload:', error);
        res.status(500).json({ message: 'Error completando upload' });
    }
};

const getUploadProgress = (req, res) => {
    try {
        const { sessionId } = req.params;
        const { totalChunks } = req.query;
        
        if (!totalChunks) {
            return res.status(400).json({ 
                message: 'totalChunks es requerido como query parameter' 
            });
        }
        
        const progress = fileUtils.getUploadProgress(sessionId, parseInt(totalChunks));
        
        res.json(progress);
    } catch (error) {
        console.error('Error en getUploadProgress:', error);
        res.status(500).json({ message: 'Error obteniendo progreso' });
    }
};

const cancelUpload = (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const cleaned = fileUtils.cleanupChunks(sessionId);
        
        if (cleaned) {
            res.json({ 
                message: 'Upload cancelado y recursos liberados',
                sessionId 
            });
        } else {
            res.status(404).json({ 
                message: 'Sesión no encontrada o ya cancelada',
                sessionId 
            });
        }
    } catch (error) {
        console.error('Error en cancelUpload:', error);
        res.status(500).json({ message: 'Error cancelando upload' });
    }
};

module.exports = {
    initiateUpload,
    uploadChunk,
    completeUpload,
    getUploadProgress,
    cancelUpload
};