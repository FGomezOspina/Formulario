// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const admin = require('firebase-admin');
const basicAuth = require('express-basic-auth');


// Inicializar Firebase Admin SDK
const serviceAccount = require('./formulario-531b6-firebase-adminsdk-1z5gl-dd144b687f.json');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
  storageBucket: `${process.env.FIREBASE_PROJECT_ID}.appspot.com`,
  firestore: {
    ignoreUndefinedProperties: false
  }
});


const db = admin.firestore();

// Inicializar Express
const app = express();

// Configurar EJS como motor de plantillas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Asegúrate de tener una carpeta 'views'

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ruta GET para servir el formulario
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Ruta POST para manejar el envío del formulario
app.post('/submit', async (req, res) => {
  try {
    console.log('Datos del formulario:', req.body);

    const cliente = {
      nombreEmpresa: req.body.nombreEmpresa,
      nombreCompleto: req.body.nombreCompleto,
      descripcionPuesto: req.body.descripcionPuesto,
      direccion: req.body.direccion,
      codigoPostal: req.body.codigoPostal,
      ciudad: req.body.ciudad,
      pais: req.body.pais,
      telefono: req.body.telefono,
      email: req.body.email,
      sitioWeb: req.body.sitioWeb,
      notasAdicionales: req.body.notasAdicionales,
      categoria: req.body.categoria || 'Sin categoría',
      fecha: admin.firestore.FieldValue.serverTimestamp(),
    };
    

    // Agregar el documento a Firestore
    await db.collection('clientes').add(cliente);

    // Redirigir al usuario a la página de "Gracias"
    res.redirect('/thankyou');
  } catch (error) {
    console.error('Error al procesar el formulario:', error);
    res.status(500).send('Hubo un error al enviar el formulario.');
  }
});

// Ruta GET para la página de "Gracias"
app.get('/thankyou', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'thankyou.html'));
});

// Configurar autenticación básica para la ruta /admin
app.use('/admin', basicAuth({
    users: { 'admin': '1234' }, // Reemplaza con tus credenciales
    challenge: true,
    realm: 'Administración de Firestore',
  }));

// Ruta GET para la página administrativa
app.get('/admin', async (req, res) => {
  try {
    const snapshot = await db.collection('clientes').orderBy('fecha', 'desc').get();
    const clientes = [];
    snapshot.forEach(doc => {
      clientes.push({ id: doc.id, ...doc.data() });
    });
    res.render('admin', { clientes });
  } catch (error) {
    console.error('Error al obtener los clientes:', error);
    res.status(500).send('Hubo un error al obtener los datos.');
  }
});

// Middleware para manejar errores generales
app.use((err, req, res, next) => {
  if (err) {
    console.error('Error General:', err);
    return res.status(500).send('Hubo un error al procesar tu solicitud.');
  }
  next();
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
