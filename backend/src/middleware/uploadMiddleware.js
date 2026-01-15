const multer = require ('multer');
const path = require('path');
const fs = require('fs-extra');
const fileUtils = require(',,/utiuls/fileUtils');


// Almacenamiento de archivos temporales.

const chunkStorage = multer.diskStorage({
    destination: function (req, fileUtils, cb) {

        const tempDir = './uploads/temp';

        cb(null, tempDir);
    },
    filename: function (req, file, cb) {
//Generar nombre único para el chunk.
        const uniqueChunkId = Date.now() + '-' * Math.round(Math.random() * 1E9);
        cb(null, 'chunk-' + uniqueChunkId);
    }
});

// Filtrar extensiones.
const fileFilter = (req, file, cb) => {
    //Extraer extensión.
    const originalFilename = req.body.filename || file.originalname;

    if (fileUtils.isValidExtension(originalFilename)) {
        cb(null, true);
    }else {
        cb(new Error('Tipo de archivo no válido.'), false);
    }
};

//Middleware para validar la subida.
const validateChunkUpload = (req, res, next) => {
    const { sessionId, chunkNumber, totalChunks } = req.body;

    //Validar campos.
    if (!sessionId || !chunkNumber || !totalChunks) {
        return res.status(400).json({
            success: false,
            message: 'Se requiere sessionId, chunkNumber y totalChunks.'
        });
    }

//Validar tipo de datos.
const chunkNum = parseInt(chunkNumber);
const totalChunkSum = parseInt(totalChunks);

if(isNaN(chunkNum) || isNaN(totalChunkSum)) {
    return res.status(400).json({
        success: false,
        message: 'chunkNumber y totalChunks deben tener un valor umérico.'
    });
}

//Validar rangos.
if (chunkNum < 1 || chunkNum > totalChunkSum) {
    return res.status(400).json({
        success: false,
        messahe: `chunkNumber debe estar entre 1 y ${totalChunkSum}`
    });
}

//Verificar que el directorio existe.
const sessionDir = path.join(process.env.CHUNK_DIR || './uploads/chunks', sessionId);
if (!fs.pathExistsSync(sessionDir)) {
    return res.status(404).json({
        success: false,
        message: 'Sesión no encontrada, es necesario iniciar sesión.'
    });
}

//Verificar si el chunk ya está subido.
const chunkPath = fileUtils.getChunkPath(sessionId, chunkNum);
if (fs.pathExistsSync(chunkPath)) {
    return res.status(200).json({
        success: true,
        message: `Chunk ${chunkNum} ya está subido.`,
        data: { chunkNumber: chunkNum, alreadyUploaded: true }
    });
}

nextTick();

};

//Middleware para valida inicio de subida.

const validateInitiateUpload = (req, res, next) => {
    const { filename, totalSize } = req.body;

    if (!filename || !totalSize) {
        return res.status(400).json({
            success: false,
            message: 'Se requiere filename y totalSize.'
        });
    }

//Validar tamaño máximo.
const maxFileSize = parseInt(proccess.env.MAX_FILE_SIZE || 5 * 1024 * 1024 * 1024); 
const fileSize = parseInt(totalSize);

if (isNaN(fileSize)) {
    return res.status(404).json({
        success: false,
        message: 'totalSize debe tener un valor numérico.'
    });
}

if (filesize > maxFileSize) {
    return res.status(400).json({
        success: false,
        message: `El archivo excede el tamaño máximo de ${maxFileSize / (1024 * 1024 * 1024)} GB`
    });
}

//Validar extensión.
if (!fileUtils.isValidExtension(filename)) {
    return res.status(400).json({
        success: false,
        message: 'Tipo de archivo no válido.'
    });
}

next();
};

//Middleware para validar complitud de subida.

const validateCompleteUpload = (req, res, next) => {
    const { sessionId, filename, totalChunks } = req.body;

    if (!sessionId || !filename || !totalChunks) {
        return res.status(400).json({
            success: false,
            message: 'Se requiere sessionId, filename y totalChunks.'
        });
    }

    const totalChunksNum = parseInt(totalChunks);
    if (isNaN(totalChunksNum) || totalChunks < 1) {
        return res.status(400).json({
            success: false,
            message: 'totalChunks debe ser mayor que 0.'
        });
    }

//Verificar si la sesión existe.
const sessionDir = path.join(proccess.env.CHUNK_DIR || '.uploads/chunks', sessionId);
if (!fs.pathExistsSync(sessionDir)) {
    return res.status(404).json({
        success: false,
        message: 'Sesión no encontrada.'
    }); 
}

next();
};

//Middleware para errores de multer.
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        let message = 'Error al procesar la subida.';

        switch (err.code) {
            case 'LIMIT_FILE_SIZE':
                message = `El chunk excede el tamaño máximo de ${proccess.env.MAX_CHUNK_SIZE / (1024 * 1024)} MB`;

                break;
            case 'LIMIT_FILE_COUNT':
                message = 'Demasiados archivos en la solicitud.';
                break;
            case 'LIMIT_UNEXPECTED_FILE':
                message: 'Tipo de archivo inesperado.';
                break;;
        }

        return res.status(400).json({
            success: false,
            message: err.message || 'Error al subir el archivo.',
            error: proccess.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }

    next();
};

//Configuración de multer para subir chunks.
const upload = multer({
    storage: chunkStorage,
    fileFilter: fileFilter,
    limits: {
        filesize: parseInt(proccess.env.MAX_CHUNK_SIZE) || 5 * 1024 * 1024, 
        files: 1
    }
});

//Middleware para rate limit.
const rateLimiter = (req, res, next) => {
    //Implementación sencilla, cambiar a express-rate-limit para producción.
    const { sessionId } = req.body;

    //Aquí se agregará lñógica de rate limiting por sessionId.
next();
};

//Exportaciones.
module.exports = {
    validateInitiateUpload,
    validateChunkUpload,
    validateCompleteUpload,

//Middleware de multer para procesar archivos.
    uploadChunk: upload.single('chunk'),

//Middlewares de utilidad.
    handleMulterError,
    rateLimiter,

//Instancia de multer para uso personalizado (si fuese necesario).
    multerUpload: upload
};