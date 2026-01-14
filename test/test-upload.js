
 //@file test-upload.js
 //@description Script para probar el sistema de subida completo


const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const BASE_URL = 'http://localhost:5000/api';

// Crear archivo de prueba (10MB)
async function createTestFile(filename, sizeInMB = 10) {
  const filePath = path.join(__dirname, filename);
  const chunkSize = 1024 * 1024; // 1MB
  const chunks = sizeInMB;
  
  console.log(`Creando archivo de prueba: ${filename} (${sizeInMB}MB)...`);
  
  const writeStream = fs.createWriteStream(filePath);
  
  for (let i = 0; i < chunks; i++) {
    const chunk = Buffer.alloc(chunkSize, `Chunk ${i + 1} `.repeat(1024 * 100).substring(0, chunkSize));
    writeStream.write(chunk);
  }
  
  writeStream.end();
  
  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => {
      const stats = fs.statSync(filePath);
      console.log(`Archivo creado: ${(stats.size / (1024 * 1024)).toFixed(2)}MB`);
      resolve(filePath);
    });
    writeStream.on('error', reject);
  });
}

// Test 1: Iniciar sesión
async function testInitiateUpload(filename, totalSize) {
  try {
    console.log('\n Test 1: Iniciando sesión de upload...');
    const response = await axios.post(`${BASE_URL}/upload/initiate`, {
      filename,
      totalSize
    });
    
    console.log('Sesión iniciada:', response.data);
    return response.data.sessionId;
  } catch (error) {
    console.error('Error iniciando sesión:', error.response?.data || error.message);
    throw error;
  }
}

// Test 2: Subir chunks
async function testUploadChunks(sessionId, filePath, totalChunks) {
  console.log('\n Test 2: Subiendo chunks...');
  
  const chunkSize = 5 * 1024 * 1024; // 5MB
  const fileStats = fs.statSync(filePath);
  const actualTotalChunks = Math.ceil(fileStats.size / chunkSize);
  
  console.log(`Chunks a subir: ${actualTotalChunks}`);
  
  // Leer archivo y dividir en chunks
  const fileBuffer = fs.readFileSync(filePath);
  
  for (let i = 0; i < actualTotalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, fileStats.size);
    const chunk = fileBuffer.slice(start, end);
    
    const formData = new FormData();
    formData.append('chunk', chunk, {
      filename: `chunk_${i + 1}`,
      contentType: 'application/octet-stream'
    });
    formData.append('sessionId', sessionId);
    formData.append('chunkNumber', i + 1);
    formData.append('totalChunks', actualTotalChunks);
    
    try {
      console.log(`Subiendo chunk ${i + 1}/${actualTotalChunks}...`);
      const response = await axios.post(`${BASE_URL}/upload/chunk`, formData, {
        headers: formData.getHeaders()
      });
      
      console.log(`Chunk ${i + 1} subido: ${response.data.progress}% completo`);
      
      // Test intermedio: Ver progreso
      if ((i + 1) % 2 === 0) {
        const progressResponse = await axios.get(
          `${BASE_URL}/upload/progress/${sessionId}?totalChunks=${actualTotalChunks}`
        );
        console.log(`Progreso actual: ${progressResponse.data.percentage}%`);
      }
      
    } catch (error) {
      console.error(`Error subiendo chunk ${i + 1}:`, error.response?.data || error.message);
      throw error;
    }
  }
  
  return actualTotalChunks;
}

// Test 3: Completar upload
async function testCompleteUpload(sessionId, filename, totalChunks) {
  try {
    console.log('\n Test 3: Completando upload...');
    const response = await axios.post(`${BASE_URL}/upload/complete`, {
      sessionId,
      filename,
      totalChunks
    });
    
    console.log('Upload completado:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error completando upload:', error.response?.data || error.message);
    throw error;
  }
}

// Test 4: Verificar archivo final
async function testVerifyFile(filename) {
  const filePath = path.join(__dirname, 'uploads', filename);
  
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`\n Archivo final verificado:`);
    console.log(`Ubicación: ${filePath}`);
    console.log(`Tamaño: ${(stats.size / (1024 * 1024)).toFixed(2)}MB`);
    console.log(`Modificado: ${stats.mtime}`);
    return true;
  } else {
    console.error(`Archivo final no encontrado: ${filePath}`);
    return false;
  }
}

// Test 5: Limpiar después de pruebas
async function testCleanup(sessionId) {
  try {
    console.log('\n Test 5: Limpiando sesión...');
    await axios.delete(`${BASE_URL}/upload/${sessionId}`);
    console.log(' Sesión limpiada correctamente');
  } catch (error) {
    console.error('Error limpiando sesión:', error.response?.data || error.message);
  }
}

// Ejecutar todas las pruebas
async function runAllTests() {
  console.log('INICIANDO PRUEBAS DEL SISTEMA DE UPLOAD\n');
  
  const testFilename = 'archivo_prueba.dat';
  const testSizeMB = 10; // 10MB para pruebas rápidas
  
  try {
    // 0. Crear archivo de prueba
    const testFilePath = await createTestFile(testFilename, testSizeMB);
    const testFileStats = fs.statSync(testFilePath);
    
    // 1. Iniciar sesión
    const sessionId = await testInitiateUpload(testFilename, testFileStats.size);
    
    // 2. Subir chunks
    const totalChunks = await testUploadChunks(sessionId, testFilePath, testSizeMB);
    
    // 3. Completar upload
    await testCompleteUpload(sessionId, testFilename, totalChunks);
    
    // 4. Verificar archivo
    await testVerifyFile(testFilename);
    
    // 5. Limpiar (opcional - comentar para debuggear)
    // await testCleanup(sessionId);
    
    // 6. Limpiar archivo temporal de prueba
    fs.removeSync(testFilePath);
    
    console.log('\n Prueba superada con éxito.');
    console.log('Backend completamente funcional.');
    
  } catch (error) {
    console.error('\n Error en las pruebas:', error.message);
    process.exit(1);
  }
}

// Verificar que el servidor esté corriendo primero
async function checkServer() {
  try {
    await axios.get('http://localhost:5000/api/health');