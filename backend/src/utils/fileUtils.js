const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const CHUNK_DIR = process.env.CHUNK_DIR || './uploads/chunks';
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_CHUNK_SIZE = parseInt(process.env.MAX_CHUNK_SIZE) || 5 * 1024 * 1024;

const generateSessionId = () => {
    return uuidv4();
};

const isValidExtension = (filename) => {
    const allowedExtensions = process.env.ALLOWED_EXTENSIONS 
        ? process.env.ALLOWED_EXTENSIONS.split(',') 
        : ['.jpg', '.jpeg', '.png', '.pdf', '.mp4', '.mov', '.zip', '.txt'];
    const ext = path.extname(filename).toLowerCase();
    return allowedExtensions.includes(ext);
};

const calculateTotalChunks = (totalSize) => {
    return Math.ceil(totalSize / MAX_CHUNK_SIZE);
};

const createSessionDirectory = (sessionId) => {
    const sessionDir = path.join(CHUNK_DIR, sessionId);
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }
    return sessionDir;
};

const getChunkPath = (sessionId, chunkNumber) => {
    return path.join(CHUNK_DIR, sessionId, `chunk_${chunkNumber}`);
};

const chunkExists = (sessionId, chunkNumber) => {
    const chunkPath = getChunkPath(sessionId, chunkNumber);
    return fs.existsSync(chunkPath);
};

const getUploadProgress = (sessionId, totalChunks) => {
    try {
        const sessionDir = path.join(CHUNK_DIR, sessionId);
        if (!fs.existsSync(sessionDir)) {
            return { percentage: 0, uploadedChunks: 0, totalChunks, isComplete: false };
        }
        
        const chunks = fs.readdirSync(sessionDir);
        const uploadedChunks = chunks.length;
        const percentage = Math.round((uploadedChunks / totalChunks) * 100);
        
        return { percentage, uploadedChunks, totalChunks, isComplete: uploadedChunks === totalChunks };
    } catch (error) {
        return { percentage: 0, uploadedChunks: 0, totalChunks, isComplete: false };
    }
};

const combineChunks = async (sessionId, filename) => {
    const sessionDir = path.join(CHUNK_DIR, sessionId);
    const outputPath = path.join(UPLOAD_DIR, filename);
    
    try {
        const chunks = fs.readdirSync(sessionDir)
            .filter(file => file.startsWith('chunk_'))
            .sort((a, b) => {
                const numA = parseInt(a.replace('chunk_', ''));
                const numB = parseInt(b.replace('chunk_', ''));
                return numA - numB;
            });
        
        const writeStream = fs.createWriteStream(outputPath);
        
        for (const chunkFile of chunks) {
            const chunkPath = path.join(sessionDir, chunkFile);
            const chunkData = fs.readFileSync(chunkPath);
            writeStream.write(chunkData);
        }
        
        writeStream.end();
        
        return new Promise((resolve, reject) => {
            writeStream.on('finish', () => resolve(outputPath));
            writeStream.on('error', reject);
        });
    } catch (error) {
        throw new Error(`Error combinando chunks: ${error.message}`);
    }
};

const cleanupChunks = (sessionId) => {
    try {
        const sessionDir = path.join(CHUNK_DIR, sessionId);
        if (fs.existsSync(sessionDir)) {
            fs.removeSync(sessionDir);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error limpiando chunks:', error);
        return false;
    }
};

module.exports = {
    generateSessionId,
    isValidExtension,
    calculateTotalChunks,
    createSessionDirectory,
    getChunkPath,
    chunkExists,
    getUploadProgress,
    combineChunks,
    cleanupChunks
};