require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const admin = require('firebase-admin');
const basicAuth = require('express-basic-auth');
const multer = require('multer');
const tesseract = require('tesseract.js');
const fs = require('fs');

// Load service account credentials
const serviceAccount = require('./formulario-531b6-firebase-adminsdk-1z5gl-dd144b687f.json');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'formulario-531b6.appspot.com',
});

// Initialize Firestore and Storage
const db = admin.firestore();
const bucket = admin.storage().bucket();

// Initialize Express
const app = express();

// Configure multer for image uploads (temporary storage)
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only JPEG and PNG images are allowed'));
  }
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '10mb' })); // Increase limit if expecting large images
app.use(express.static(path.join(__dirname, 'public')));

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Route GET to serve the form
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Route POST to extract text from an uploaded image
app.post('/extract-text-upload', upload.single('image'), async (req, res) => {
  try {
    const imagePath = req.file.path;
    console.log('Received file:', req.file);

    // Use Tesseract.js to extract text from the image
    const { data: { text } } = await tesseract.recognize(imagePath, 'eng');
    console.log('Extracted text:', text);

    // Delete the temporary image file after processing
    fs.unlinkSync(imagePath);

    // Return the extracted text as JSON
    res.json({ extractedText: text });
  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).json({ error: 'Error extracting text from image.' });
  }
});

// Route POST to extract text from a real-time captured image
app.post('/extract-text-realtime', async (req, res) => {
  try {
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: 'No image data provided.' });
    }

    // Decode the base64 image and save it temporarily
    const base64Data = imageData.replace(/^data:image\/png;base64,/, "");
    const imagePath = `uploads/realtime-${Date.now()}.png`;
    fs.writeFileSync(imagePath, base64Data, 'base64');

    console.log('Received real-time image for scanning:', imagePath);

    // Use Tesseract.js to extract text from the image
    const { data: { text } } = await tesseract.recognize(imagePath, 'eng');
    console.log('Extracted real-time text:', text);

    // Delete the temporary image file after processing
    fs.unlinkSync(imagePath);

    // Return the extracted text as JSON
    res.json({ extractedText: text });
  } catch (error) {
    console.error('Error processing real-time image:', error);
    res.status(500).json({ error: 'Error extracting text from real-time image.' });
  }
});

// Route POST to handle logo upload
app.post('/upload-logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No logo file uploaded.' });
    }

    const logoPath = req.file.path;
    const logoFileName = `logos/${Date.now()}_${req.file.originalname}`;
    const file = bucket.file(logoFileName);

    // Upload the logo to Firebase Storage
    await bucket.upload(logoPath, {
      destination: logoFileName,
      metadata: {
        contentType: req.file.mimetype,
      },
    });

    // Make the file public (optional, depending on your use case)
    await file.makePublic();

    // Get the public URL
    const logoURL = `https://storage.googleapis.com/${bucket.name}/${file.name}`;

    console.log('Uploaded logo to:', logoURL);

    // Delete the temporary logo file after uploading
    fs.unlinkSync(logoPath);

    // Return the logo URL
    res.json({ logoURL });
  } catch (error) {
    console.error('Error uploading logo:', error);
    res.status(500).json({ error: 'Error uploading logo.' });
  }
});

// Route POST to handle form submission and save data to Firestore
// Ruta POST para manejar el envío del formulario y guardar datos en Firestore
app.post('/submit', upload.none(), async (req, res) => {
  try {
    // Obtener los datos del formulario
    const { extractedText, additionalNotes, logoURL } = req.body;

    // Verificar que 'extractedText' esté presente y no esté vacío
    if (!extractedText || extractedText.trim() === "") {
      // Puedes optar por redirigir al usuario con un mensaje de error
      return res.status(400).send('No text has been extracted. Please upload an image and ensure text extraction is successful.');
      
      // Alternativamente, podrías redirigir al formulario con un mensaje de error usando query params o sesiones
      // Por simplicidad, utilizaremos el mensaje directo aquí
    }

    // Crear una nueva entrada de cliente con los datos recibidos
    const client = {
      extractedText: extractedText.trim(), // Texto extraído de la imagen
      additionalNotes: additionalNotes || "",
      submissionDate: admin.firestore.FieldValue.serverTimestamp(),
      logoURL: logoURL || "", // URL del logo opcional
    };

    // Guardar el documento en Firestore
    await db.collection('clients').add(client);

    // Redirigir al usuario a la página de "Gracias"
    res.redirect('/thankyou');
  } catch (error) {
    console.error('Error submitting form:', error);
    res.status(500).send('There was an error submitting the form.');
  }
});


// Route GET for the "Thank You" page
app.get('/thankyou', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'thankyou.html'));
});

// Configure basic authentication for the /admin route
app.use(
  '/admin',
  basicAuth({
    users: { admin: '1234' }, // Access credentials (change for production)
    challenge: true,
    realm: 'Firestore Administration',
  })
);

// Route GET for the administrative page
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

// General error handling middleware
app.use((err, req, res, next) => {
  if (err) {
    console.error('General Error:', err);
    return res.status(500).send('There was an error processing your request.');
  }
  next();
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
