// server.js

require('dotenv').config(); // Cargar variables de entorno desde .env
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const admin = require('firebase-admin');
const basicAuth = require('express-basic-auth');
const multer = require('multer');
const tesseract = require('tesseract.js');
const fs = require('fs');

// Inicializar Firebase Admin SDK con las credenciales de la cuenta de servicio
const serviceAccount = require('./formulario-531b6-firebase-adminsdk-1z5gl-dd144b687f.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'formulario-531b6.appspot.com', // Asegúrate de que este nombre sea correcto
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

// Configuración de multer para manejar múltiples campos de archivo (imagen y logo)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Carpeta temporal para almacenar archivos subidos
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Filtrar archivos para aceptar solo imágenes JPEG y PNG
const fileFilter = function (req, file, cb) {
  const filetypes = /jpeg|jpg|png/;
  const mimetype = filetypes.test(file.mimetype);
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('Only JPEG and PNG images are allowed'));
};

// Inicializar multer con la configuración
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5 MB por archivo
  fileFilter: fileFilter
});

// Inicializar Express
const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '10mb' })); // Aumentar el límite si se esperan imágenes grandes
app.use(express.static(path.join(__dirname, 'public')));

// Establecer EJS como motor de plantillas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Ruta GET para servir el formulario principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Ruta GET para la página de agradecimiento
app.get('/thankyou', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'thankyou.html'));
});

// Ruta POST unificada para manejar la subida de archivos (imagen y logo)
app.post('/upload', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'logo', maxCount: 1 }]), async (req, res) => {
  try {
    const files = req.files;
    const additionalNotes = req.body.additionalNotes || '';

    // Validar que se haya subido una imagen para escaneo de texto
    if (!files['image'] || files['image'].length === 0) {
      return res.status(400).json({ error: 'No image uploaded for text extraction.' });
    }

    const imageFile = files['image'][0];
    const imagePath = imageFile.path;

    // Usar Tesseract.js para extraer texto de la imagen
    const { data: { text } } = await tesseract.recognize(imagePath, 'eng');
    console.log('Extracted text:', text);

    // Eliminar el archivo de imagen temporal después del procesamiento
    fs.unlinkSync(imagePath);

    let logoURL = '';

    // Si se ha subido un logo, procesarlo
    if (files['logo'] && files['logo'].length > 0) {
      const logoFile = files['logo'][0];
      const logoPath = logoFile.path;
      const logoFileName = `logos/${Date.now()}_${logoFile.originalname}`;
      const file = bucket.file(logoFileName);

      // Subir el logo a Firebase Storage
      await bucket.upload(logoPath, {
        destination: logoFileName,
        metadata: {
          contentType: logoFile.mimetype,
        },
      });

      // Hacer el archivo público (opcional, dependiendo de tu caso de uso)
      await file.makePublic();

      // Obtener la URL pública
      logoURL = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
      console.log('Uploaded logo to:', logoURL);

      // Eliminar el archivo temporal del servidor después de subir
      fs.unlinkSync(logoPath);
    }

    // Crear una nueva entrada de cliente con los datos recibidos
    const client = {
      extractedText: text.trim(), // Texto extraído de la imagen
      additionalNotes: additionalNotes,
      submissionDate: admin.firestore.FieldValue.serverTimestamp(),
      logoURL: logoURL, // URL del logo opcional
    };

    // Guardar el documento en Firestore
    await db.collection('clients').add(client);

    // Responder con éxito y el texto extraído
    res.json({ message: 'Form submitted successfully.', extractedText: text.trim() });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ error: 'There was an error uploading the files.' });
  }
});

// Ruta GET para el panel administrativo (protegido con autenticación básica)
app.use(
  '/admin',
  basicAuth({
    users: { admin: process.env.ADMIN_PASS || '1234' }, // Cambia esto para producción
    challenge: true,
    realm: 'Firestore Administration',
  })
);

// Ruta GET para la página administrativa
app.get('/admin', async (req, res) => {
  try {
    const snapshot = await db.collection('clients').orderBy('submissionDate', 'desc').get();
    const clients = [];
    snapshot.forEach((doc) => {
      clients.push({ id: doc.id, ...doc.data() });
    });
    res.render('admin', { clients });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).send('There was an error fetching the data.');
  }
});

// Middleware de manejo de errores generales
app.use((err, req, res, next) => {
  if (err) {
    console.error('General Error:', err);
    return res.status(500).send('There was an error processing your request.');
  }
  next();
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
