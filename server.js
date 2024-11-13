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
const validator = require('validator'); // Librería para validación
const sgMail = require('@sendgrid/mail'); // Importar SendGrid Mail
const axios = require('axios'); // Importar Axios

// Inicializar Firebase Admin SDK con las credenciales de la cuenta de servicio
const serviceAccount = require('./formulario-531b6-firebase-adminsdk-1z5gl-dd144b687f.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'formulario-531b6.appspot.com', // Asegúrate de que este nombre sea correcto
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

// Configurar SendGrid con la API Key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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

// Establecer EJS como motor de plantillas (si usas EJS para el admin)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

<<<<<<< HEAD
// Middleware para registrar todas las solicitudes entrantes
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Definir productos prioritarios por SKU y nombre
=======
// Definir productos prioritarios por SKU y nombre (si es necesario)
>>>>>>> heroku/main
const productosPrioritarios = [
    { sku: '00015', name: '00015' },
    { sku: '00014', name: '00014' },
    { sku: null, name: 'Dracaena Reflexa' },
    { sku: null, name: 'Heliconia SP' },
    { sku: '00012', name: '00012' },
    { sku: null, name: 'Lobster Salmon' },
    { sku: null, name: 'Orthotricha Tricolor' }
];

// Definir el orden de categorías (si es necesario)
const ordenCategorias = ['Foliages', 'Tropical Flowers'];

// Definir categorías excluidas (si es necesario)
const excludedCategories = ['Hydrangeas'];

// Definir nombres de productos a excluir (si es necesario)
const excludedProductNames = [
    'Appaloosa B-DB',
    'Appaloosa SB-R-W',
    'Appaloosa SB-W',
    'Bouquets Boxes',
    'Cocculus laurifolius',
    'Exotic Greens BQT',
    'Fancy Green BQT',
    'Freedom Rose',
    'Ginger Shampoo BQ',
    'Grace BQT',
    'Hydrangea Blue Extra',
    'Hydrangea Blue Jumbo',
    'Hydrangea Blue Petite',
    'Hydrangea Blue Premium',
    'Hydrangea Blue Super',
    'Hydrangea Mini Blue',
    'Hydrangea Mini White',
    'Hydrangea White Extra',
    'Hydrangea White Giant',
    'Hydrangea White Jumbo',
    'Hydrangea White Petite',
    'Hydrangea White Premium',
    'Ivy BQT',
    'Marsella\'s Beauty BQT',
    'Rainbow BQT',
    'Shadow B-P',
    'Shadow B-W',
    'White'
];

// Función para obtener productos de Ecwid (si es necesario)
async function fetchEcwidProducts() {
    try {
        const storeId = process.env.ECWID_STORE_ID;
        const apiToken = process.env.ECWID_API_TOKEN;
        const response = await axios.get(`https://app.ecwid.com/api/v3/${storeId}/products`, {
            headers: {
                'Authorization': `Bearer ${apiToken}`
            },
            params: {
                limit: 100, // Puedes ajustar el límite según tus necesidades
                offset: 0
            }
        });
        console.log('Respuesta de la API de Ecwid:', JSON.stringify(response.data, null, 2)); // Depuración
        return response.data.items; // Ajusta según la respuesta de la API
    } catch (error) {
        console.error('Error al obtener productos de Ecwid:', error.response ? error.response.data : error.message);
        return [];
    }
}

// Función para obtener la configuración del store (si es necesario)
async function fetchStoreSettings() {
    try {
        const storeId = process.env.ECWID_STORE_ID;
        const apiToken = process.env.ECWID_API_TOKEN;
        const response = await axios.get(`https://app.ecwid.com/api/v3/${storeId}/settings`, {
            headers: {
                'Authorization': `Bearer ${apiToken}`
            }
        });
        console.log('Store Settings:', JSON.stringify(response.data, null, 2)); // Depuración
        return response.data;
    } catch (error) {
        console.error('Error al obtener la configuración del store:', error.response ? error.response.data : error.message);
        return null;
    }
}

// Función para ordenar los productos (si es necesario)
function ordenarProductos(productos, prioritarios, ordenCategorias) {
    const productosOrdenados = [];

    // Crear copias para manipulación
    let productosRestantes = [...productos];

    // 1. Añadir productos prioritarios en el orden definido
    prioritarios.forEach(prioritario => {
        let index = -1;

        if (prioritario.sku) {
            index = productosRestantes.findIndex(p => p.sku === prioritario.sku);
        } else if (prioritario.name) {
            index = productosRestantes.findIndex(p => p.name === prioritario.name);
        }

        if (index !== -1) {
            productosOrdenados.push(productosRestantes[index]);
            productosRestantes.splice(index, 1); // Eliminar del arreglo restante
        } else {
            console.warn(`Producto prioritario no encontrado: ${prioritario.sku || prioritario.name}`);
        }
    });

    // 2. Agrupar productos por categorías en el orden definido
    ordenCategorias.forEach(categoria => {
        const productosCategoria = productosRestantes.filter(p => p.categories && p.categories.some(cat => cat.name === categoria));

        // Ordenar alfabéticamente dentro de la categoría (opcional)
        productosCategoria.sort((a, b) => a.name.localeCompare(b.name));

        productosOrdenados.push(...productosCategoria);

        // Eliminar los productos añadidos del arreglo restante
        productosRestantes = productosRestantes.filter(p => !(p.categories && p.categories.some(cat => cat.name === categoria)));
    });

    // 3. Añadir cualquier otro producto que no esté en las categorías especificadas
    productosRestantes.sort((a, b) => a.name.localeCompare(b.name)); // Ordenar alfabéticamente
    productosOrdenados.push(...productosRestantes);

    return productosOrdenados;
}

<<<<<<< HEAD
// Función para generar HTML de los productos sin la columna de precios
=======
// Función modificada para generar HTML de los productos sin la columna de precios (si es necesario)
>>>>>>> heroku/main
function generateProductsHTML(products) {
  if (products.length === 0) {
      return '<p>No products are available at this time.</p>';
  }

  let html = `
      <h2>Available Products:</h2>
      <table>
          <tr>
              <th>Image</th>
              <th>Name</th>
              <th>View Product</th>
          </tr>
  `;
  
  products.forEach(product => {
      let imageUrl = product.thumbnailUrl;

      if (!imageUrl && product.media && product.media.images && product.media.images.length > 0) {
          imageUrl = product.media.images[0].imageOriginalUrl;
      }

      if (!imageUrl) {
          imageUrl = '';
      }

      const productUrl = `https://majorfd.com/${product.autogeneratedSlug}-p${product.id}`;

      html += `
          <tr>
              <td>${imageUrl ? `<img src="${imageUrl}" alt="${product.name}" class="product-image" style="width:50px;height:auto;">` : 'N/A'}</td>
              <td>${product.name}</td>
              <td><a href="${productUrl}" target="_blank">View Product</a></td>
          </tr>
      `;
  });
  
  html += '</table>';
  return html;
}

<<<<<<< HEAD
// Función para enviar correo de agradecimiento
async function sendThankYouEmail(toEmail, clientData = {}) {
=======
// Función para enviar el correo de agradecimiento
async function sendThankYouEmail(toEmail) {
>>>>>>> heroku/main
  try {
      // Plantilla para ambos métodos
      const templatePath = path.join(__dirname, 'views', 'thank-you.html');
      let htmlContent = fs.readFileSync(templatePath, 'utf-8');

      // Reemplazar los placeholders con los datos correspondientes
      htmlContent = htmlContent.replace('{{logo}}', clientData.logoURL || 'https://firebasestorage.googleapis.com/v0/b/formulario-531b6.appspot.com/o/logo.jpeg?alt=media&token=202ee807-bd5c-44ac-9b1e-ce443cb11837');

      // Verificar si es una adición manual y reemplazar los campos adicionales
      if (clientData.name || clientData.phone || clientData.additionalNotes) {
          htmlContent = htmlContent.replace('{{name}}', clientData.name || '');
          htmlContent = htmlContent.replace('{{phone}}', clientData.phone || '');
          htmlContent = htmlContent.replace('{{additionalNotes}}', clientData.additionalNotes || '');
      } else {
          // Eliminar los campos manuales si no existen
          htmlContent = htmlContent.replace('{{name}}', '');
          htmlContent = htmlContent.replace('{{phone}}', '');
          htmlContent = htmlContent.replace('{{additionalNotes}}', '');
      }

      // Si hay productos para mostrar (agregado por tarjeta)
      if (clientData.productsHTML) {
          htmlContent = htmlContent.replace('{{products}}', clientData.productsHTML);
      } else {
          // Eliminar la sección de productos si no existen
          htmlContent = htmlContent.replace('{{products}}', '');
      }

      const msg = {
          to: toEmail,
          from: 'info@fli.com.co',
          replyTo: 'info@fli.com.co',
          subject: '¡Gracias por Contactarnos!',
          html: htmlContent,
      };
      
      await sgMail.send(msg);
      console.log(`Correo de agradecimiento enviado a: ${toEmail}`);
  } catch (error) {
      console.error(`Error al enviar el correo a ${toEmail}:`, error.response ? error.response.body : error.message);
  }
}

// Ruta GET para servir el formulario principal
app.get('/', (req, res) => {
  console.log('GET / - Serviendo index.html');
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Ruta GET para la página de agradecimiento
app.get('/thankyou', (req, res) => {
  console.log('GET /thankyou - Serviendo thankyou.html');
  res.sendFile(path.join(__dirname, 'views', 'thankyou.html')); // Asegúrate de que este archivo existe
});

<<<<<<< HEAD
// Ruta POST para extraer el texto de la imagen (Agregar por Tarjeta)
app.post('/extract', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'logo', maxCount: 1 }]), async (req, res) => {
=======
// Ruta POST para extraer el texto de la imagen
app.post('/extract', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'logo', maxCount: 1 }, { name: 'manual-logo-upload', maxCount: 1 }]), async (req, res) => {
>>>>>>> heroku/main
  try {
    console.log('POST /extract - Iniciando extracción de texto');

    const files = req.files;

<<<<<<< HEAD
    // Validar que se haya subido una imagen para escaneo de texto
    if (!files['image'] || files['image'].length === 0) {
      console.warn('POST /extract - No se subió ninguna imagen para extracción de texto');
      return res.status(400).json({ error: 'No image uploaded for text extraction.' });
    }

    const imageFile = files['image'][0];
    const imagePath = imageFile.path;

    console.log(`POST /extract - Procesando imagen: ${imagePath}`);

    // Usar Tesseract.js para extraer texto de la imagen
    const { data: { text } } = await tesseract.recognize(imagePath, 'eng');
    console.log('POST /extract - Texto extraído:', text);

    // Eliminar el archivo de imagen temporal después del procesamiento
    fs.unlinkSync(imagePath);
    console.log(`POST /extract - Archivo temporal eliminado: ${imagePath}`);

    let logoURL = '';

    // Si se ha subido un logo, procesarlo
    if (files['logo'] && files['logo'].length > 0) {
      const logoFile = files['logo'][0];
      const logoPath = logoFile.path;
      const logoFileName = `logos/${Date.now()}_${logoFile.originalname}`;
      const file = bucket.file(logoFileName);

      console.log(`POST /extract - Subiendo logo: ${logoPath} a ${logoFileName}`);

      // Subir el logo a Firebase Storage
      await bucket.upload(logoPath, {
        destination: logoFileName,
        metadata: {
          contentType: logoFile.mimetype,
        },
      });

      console.log(`POST /extract - Logo subido a Firebase Storage: ${logoFileName}`);

      // Hacer el archivo público (opcional, dependiendo de tu caso de uso)
      await file.makePublic();
      console.log(`POST /extract - Logo hecho público: ${logoFileName}`);

      // Obtener la URL pública
      logoURL = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
      console.log(`POST /extract - URL pública del logo: ${logoURL}`);

      // Eliminar el archivo temporal del servidor después de subir
      fs.unlinkSync(logoPath);
      console.log(`POST /extract - Archivo temporal del logo eliminado: ${logoPath}`);
    }

    // Limpiar el texto extraído
    const cleanedText = text.replace(/[^a-zA-Z0-9@.,\s-]/g, '').replace(/\s+/g, ' ').trim();
    console.log('POST /extract - Texto limpio:', cleanedText);

    // Devolver el texto extraído y la URL del logo si existe
    res.json({ extractedText: cleanedText, logoURL: logoURL });
    console.log('POST /extract - Respuesta enviada con éxito');
=======
    // Validar que se haya subido una imagen para escaneo de texto (solo para método 'card')
    if (req.body.method === 'card') {
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

      // Limpiar el texto extraído
      const cleanedText = text.replace(/[^a-zA-Z0-9@.,\s-]/g, '').replace(/\s+/g, ' ').trim();

      // Devolver el texto extraído y la URL del logo si existe
      res.json({ extractedText: cleanedText, logoURL: logoURL });
    } else {
      // Para método 'manual', no se requiere extracción de texto
      res.json({ extractedText: '', logoURL: '' });
    }
>>>>>>> heroku/main
  } catch (error) {
    console.error('POST /extract - Error durante la extracción de texto:', error);
    res.status(500).json({ error: 'There was an error extracting text from the image.' });
  }
});

<<<<<<< HEAD
// Ruta POST para guardar los datos en Firestore (Agregar por Tarjeta)
app.post('/upload', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'logo', maxCount: 1 }]), async (req, res) => {
  try {
    console.log('POST /upload - Iniciando proceso de agregación por tarjeta');

    const { extractedText, additionalNotes, email_card } = req.body; // Cambiado a email_card
    const files = req.files;

    // Validar que se haya proporcionado el texto extraído
    if (!extractedText) {
      console.warn('POST /upload - No se proporcionó texto extraído');
      return res.status(400).json({ error: 'No extracted text provided.' });
    }

    // Validar que se haya proporcionado el email
    if (!email_card) {
      console.warn('POST /upload - No se proporcionó el email');
=======
// Ruta POST para guardar los datos en Firestore
app.post('/upload', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'logo', maxCount: 1 }, { name: 'manual-logo-upload', maxCount: 1 }]), async (req, res) => {
  try {
    const { method } = req.body; // Obtener el método de ingreso
    const additionalNotes = req.body.additionalNotes;
    const files = req.files;

    // Validar que se haya proporcionado el método
    if (!method) {
      return res.status(400).json({ error: 'Method of submission is required.' });
    }

    // Validar el email en ambos métodos
    const email = req.body.email;
    if (!email) {
>>>>>>> heroku/main
      return res.status(400).json({ error: 'Email is required.' });
    }

    // Validar el formato del email en el servidor
    if (!validator.isEmail(email_card)) {
      console.warn('POST /upload - Formato de email inválido:', email_card);
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    if (method === 'card') {
      // Manejando el envío desde tarjeta
      const extractedText = req.body.extractedText;
      if (!extractedText) {
        return res.status(400).json({ error: 'No extracted text provided.' });
      }

      let logoURL = '';

<<<<<<< HEAD
      console.log(`POST /upload - Subiendo logo: ${logoPath} a ${logoFileName}`);

      // Subir el logo a Firebase Storage
      await bucket.upload(logoPath, {
        destination: logoFileName,
        metadata: {
          contentType: logoFile.mimetype,
        },
      });

      console.log(`POST /upload - Logo subido a Firebase Storage: ${logoFileName}`);

      // Hacer el archivo público (opcional, dependiendo de tu caso de uso)
      await file.makePublic();
      console.log(`POST /upload - Logo hecho público: ${logoFileName}`);

      // Obtener la URL pública
      logoURL = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
      console.log(`POST /upload - URL pública del logo: ${logoURL}`);

      // Eliminar el archivo temporal del servidor después de subir
      fs.unlinkSync(logoPath);
      console.log(`POST /upload - Archivo temporal del logo eliminado: ${logoPath}`);
    }

    // Crear una nueva entrada de cliente con los datos recibidos
    const client = {
      email: email_card.trim(), // Correo electrónico
      extractedText: extractedText.trim(), // Texto extraído de la imagen
      additionalNotes: additionalNotes || '',
      submissionDate: admin.firestore.FieldValue.serverTimestamp(),
      logoURL: logoURL, // URL del logo opcional
    };

    console.log('POST /upload - Datos del cliente a guardar:', client);

    // Guardar el documento en Firestore en la colección 'clients'
    const docRef = await db.collection('clients').add(client);
    console.log(`POST /upload - Cliente agregado con ID: ${docRef.id}`);

    // Enviar el correo de agradecimiento usando la misma plantilla
    const productos = await fetchEcwidProducts();
    const storeSettings = await fetchStoreSettings();

    // Filtrar productos para excluir las categorías definidas en excludedCategories
    let filteredProducts = productos.filter(product => {
        if (!product.categories) return true; // Si no tiene categorías, se incluye
        return !product.categories.some(cat => excludedCategories.includes(cat.name));
    });

    // Filtrar productos para excluir los nombres especificados en excludedProductNames
    filteredProducts = filteredProducts.filter(product => {
        if (!product.name) return true; // Si no tiene nombre, se incluye
        return !excludedProductNames.includes(product.name.trim());
    });

    filteredProducts = ordenarProductos(filteredProducts, productosPrioritarios, ordenCategorias);
    const productsHTML = generateProductsHTML(filteredProducts);

    await sendThankYouEmail(email_card, {
      logoURL: logoURL,
      productsHTML: productsHTML
    });

    // Responder con éxito
    res.json({ message: 'Form submitted successfully.' });
    console.log('POST /upload - Respuesta enviada con éxito');
=======
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
        email: email.trim(), // Correo electrónico
        extractedText: extractedText.trim(), // Texto extraído de la imagen
        additionalNotes: additionalNotes || '',
        submissionDate: admin.firestore.FieldValue.serverTimestamp(),
        logoURL: logoURL, // URL del logo opcional
      };

      // Guardar el documento en Firestore en la colección 'clients'
      await db.collection('clients').add(client);

      // Enviar el correo de agradecimiento
      await sendThankYouEmail(email); // Pasar solo el email

      // Responder con éxito
      res.json({ message: 'Form submitted successfully.' });

    } else if (method === 'manual') {
      // Manejando el envío manual
      const name = req.body.name;
      const phone = req.body.phone;

      // Validar campos adicionales para el método manual
      if (!name || !phone) {
        return res.status(400).json({ error: 'Name and Phone Number are required for manual submissions.' });
      }

      let logoURL = '';

      // Si se ha subido un logo, procesarlo
      if (files['manual-logo-upload'] && files['manual-logo-upload'].length > 0) {
        const logoFile = files['manual-logo-upload'][0];
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
      const manualClient = {
        email: email.trim(), // Correo electrónico
        name: name.trim(), // Nombre
        phone: phone.trim(), // Número de teléfono
        additionalNotes: additionalNotes || '',
        submissionDate: admin.firestore.FieldValue.serverTimestamp(),
        logoURL: logoURL, // URL del logo opcional
      };

      // Guardar el documento en Firestore en la colección 'manualClients'
      await db.collection('manualClients').add(manualClient);

      // Enviar el correo de agradecimiento
      await sendThankYouEmail(email); // Pasar solo el email

      // Responder con éxito
      res.json({ message: 'Manual form submitted successfully.' });
    } else {
      return res.status(400).json({ error: 'Invalid submission method.' });
    }
>>>>>>> heroku/main
  } catch (error) {
    console.error('POST /upload - Error al guardar los datos:', error);
    res.status(500).json({ error: 'There was an error saving your data.' });
  }
});

// Ruta POST para guardar los datos manualmente en Firestore (Agregar Manualmente)
app.post('/uploadManual', upload.fields([{ name: 'logo_manual', maxCount: 1 }]), async (req, res) => {
  try {
    console.log('POST /uploadManual - Iniciando proceso de agregación manual');

    const { email_manual, name, phone, additionalNotes_manual } = req.body;
    const files = req.files;

    // Log para verificar el contenido de req.body y req.files
    console.log('POST /uploadManual - req.body:', req.body);
    console.log('POST /uploadManual - req.files:', req.files);

    // Validar que se haya proporcionado el email
    if (!email_manual) {
      console.warn('POST /uploadManual - No se proporcionó el email');
      return res.status(400).json({ error: 'Email is required.' });
    }

    // Validar el formato del email
    if (!validator.isEmail(email_manual)) {
      console.warn('POST /uploadManual - Formato de email inválido:', email_manual);
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    let logoURL = '';

    // Si se ha subido un logo, procesarlo
    if (files['logo_manual'] && files['logo_manual'].length > 0) {
      const logoFile = files['logo_manual'][0];
      const logoPath = logoFile.path;
      const logoFileName = `manualLogos/${Date.now()}_${logoFile.originalname}`;
      const file = bucket.file(logoFileName);

      console.log(`POST /uploadManual - Subiendo logo: ${logoPath} a ${logoFileName}`);

      // Subir el logo a Firebase Storage
      await bucket.upload(logoPath, {
        destination: logoFileName,
        metadata: {
          contentType: logoFile.mimetype,
        },
      });

      console.log(`POST /uploadManual - Logo subido a Firebase Storage: ${logoFileName}`);

      // Hacer el archivo público (opcional, dependiendo de tu caso de uso)
      await file.makePublic();
      console.log(`POST /uploadManual - Logo hecho público: ${logoFileName}`);

      // Obtener la URL pública
      logoURL = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
      console.log(`POST /uploadManual - URL pública del logo: ${logoURL}`);

      // Eliminar el archivo temporal del servidor después de subir
      fs.unlinkSync(logoPath);
      console.log(`POST /uploadManual - Archivo temporal del logo eliminado: ${logoPath}`);
    }

    // Crear una nueva entrada de cliente manual con los datos recibidos
    const manualClient = {
      email: email_manual.trim(),
      name: name ? name.trim() : '',
      phone: phone ? phone.trim() : '',
      additionalNotes: additionalNotes_manual || '',
      submissionDate: admin.firestore.FieldValue.serverTimestamp(),
      logoURL: logoURL, // URL del logo opcional
    };

    console.log('POST /uploadManual - Datos del cliente manual a guardar:', manualClient);

    // Guardar el documento en Firestore en la colección 'manualClients'
    const docRef = await db.collection('manualClients').add(manualClient);
    console.log(`POST /uploadManual - Cliente manual agregado con ID: ${docRef.id}`);

    // Enviar el correo de agradecimiento usando la misma plantilla
    await sendThankYouEmail(email_manual, {
      logoURL: logoURL,
      name: manualClient.name,
      phone: manualClient.phone,
      additionalNotes: manualClient.additionalNotes
    });

    // Responder con éxito
    res.json({ message: 'Manual form submitted successfully.' });
    console.log('POST /uploadManual - Respuesta enviada con éxito');
  } catch (error) {
    console.error('POST /uploadManual - Error al guardar los datos manuales:', error);
    res.status(500).json({ error: 'There was an error saving your manual data.' });
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
<<<<<<< HEAD
    console.log('GET /admin - Acceso al panel administrativo');

    // Obtener clientes agregados por tarjeta
=======
    // Obtener clientes desde tarjetas
>>>>>>> heroku/main
    const snapshotClients = await db.collection('clients').orderBy('submissionDate', 'desc').get();
    const clients = [];
    snapshotClients.forEach((doc) => {
      clients.push({ id: doc.id, ...doc.data() });
    });
<<<<<<< HEAD
    console.log(`GET /admin - Clientes por tarjeta obtenidos: ${clients.length}`);

    // Obtener clientes agregados manualmente
=======

    // Obtener clientes manuales
>>>>>>> heroku/main
    const snapshotManualClients = await db.collection('manualClients').orderBy('submissionDate', 'desc').get();
    const manualClients = [];
    snapshotManualClients.forEach((doc) => {
      manualClients.push({ id: doc.id, ...doc.data() });
    });
<<<<<<< HEAD
    console.log(`GET /admin - Clientes manuales obtenidos: ${manualClients.length}`);

    res.render('admin', { clients, manualClients });
    console.log('GET /admin - Página administrativa renderizada con éxito');
=======

    res.render('admin', { clients, manualClients });
>>>>>>> heroku/main
  } catch (error) {
    console.error('GET /admin - Error al obtener los clientes:', error);
    res.status(500).send('There was an error fetching the data.');
  }
});

// Middleware de manejo de errores generales
app.use((err, req, res, next) => {
  console.error('General Error Middleware - Error capturado:', err);
  
  // Si la solicitud espera JSON, responde con JSON; de lo contrario, con HTML
  if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
    return res.status(500).json({ error: 'There was an error processing your request.' });
  } else {
    return res.status(500).send('There was an error processing your request.');
  }
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
