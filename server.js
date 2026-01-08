const path = require("path");
const fs = require("fs");

const express = require ("express");
const cors = require("cors");
const dotenv = require("dotenv");


dotenv.config();

const requireDirs = [
    process.env.UPLOAD_DIR,
    process.env.CHUNK_DIR
];

requireDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
        console.log("Carpeta creada: ${dir}");
    }
});

const app = express();

const corsOptions = {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

app.use(express.json());

app.use(express.urlencoded({extended: true}));

app.use("/uploads", express.static(process.env.UPLOAD_DIR));

app.get("api/health", (req, res) => {
    res,json({
        status: 'healthy',
        message: 'Servidor funcionando.',
        timestamp: new Date().toISOString(),
        enviroment: process.env.UPLOAD_DIR
    });
});

app.get("/", (req, res) => {
    res.send(`
<html>
    <head>
        <title>Sistema de Subida de Archivos Grandes</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .container { max-width: 800px; margin: 0 auto; }
            .endpoint { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Backend de Subida de Archivos Grandes</h1>
            <p>Servidor funcionando correctamente.</p>
            
            <h2>Endpoints Disponibles:</h2>
            <div class="endpoint">
                <strong>GET /api/health</strong> - Estado del servidor
            </div>
            <div class="endpoint">
                <strong>POST /api/upload/initiate</strong> - Iniciar subida
            </div>
            <div class="endpoint">
                <strong>POST /api/upload/chunk</strong> - Subir fragmento
            </div>
            <div class="endpoint">
                <strong>POST /api/upload/complete</strong> - Completar subida
            </div>
            
            <h2>Configuración:</h2>
            <ul>
                <li>Puerto: ${process.env.PORT}</li>
                <li>Entorno: ${process.env.NODE_ENV}</li>
                <li>Tamaño máximo: ${process.env.MAX_FILE_SIZE} bytes</li>
                <li>Extensiones permitidas: ${process.env.ALLOWED_EXTENSIONS}</li>
            </ul>
        </div>
    </body>
</html>
`);
}); 

app.use('*', (req, res) => {
    res.status(404).json({
        error: "Endpoint no localizado.",
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});

app.use((err, req, res, next) => {
    console.error("Error enj el servidor.", err);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV ===  'development' ? err.message : "Error interno en el servidor.",
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        timestamp: new Date().toISOString() 
    });
});


const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log(`
        SERVIDOR INICIADO:
        URL: http://localhost:${PORT}
        ENTORNO: ${process.env.NODE_ENV}
        UPLOADS DIR: ${process.env.UPLOAD_DIR}
        CHUNKS: ${process.env.CHUNK_DIR}
        HORA: ${new Date().toLocaleTimeString()}
        `);

        console.log('\n Endpoints disponibles:');
        console.log('   GET http://localhost:${PORT}/api/health');
        console.log('   POST http://localhost:${PORT}/api/upload/initiate');
        console.log('   POST http://localhost:${PORT}/api/upload/chunk');
        console.log('   POST http://localhost:${PORT}/api/upload/complete');
});

process.on("SIGINT", () => {
    console.log("\n\n  Recibida señal SIGINT (Ctrl+C)");
    gracefulShutdown();
});

process.on("SIGTERM", () => {
    console.log("\n\n  Recibida señal SIGTERM");
    gracefulShutdown();
});

function gracefulShutdown() {
    console.log("Cerrando el servidor.");

    server.close(() => {
        console.log("Servidor cerrado.");
        process.exit(0);
    });

    setTimeout(() => {
        console.error("Forzando cierre del servidor.");
        process.exit(1);
    }, 10000);  
}

module.exports = app;



