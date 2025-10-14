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
const serviceAccount = require('./formulario-531b6-firebase-adminsdk-1z5gl-d0a1d6cdbe.json');

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
  cb(new Error('Solo se permiten imágenes JPEG y PNG'));
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

// Middleware para registrar todas las solicitudes entrantes
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Definir productos prioritarios por SKU y nombre
const productosPrioritarios = [
    { sku: '00015', name: '00015' },
    { sku: '00014', name: '00014' },
    { sku: null, name: 'Dracaena Reflexa' },
    { sku: null, name: 'Heliconia SP' },
    { sku: '00012', name: '00012' },
    { sku: null, name: 'Lobster Salmon' },
    { sku: null, name: 'Orthotricha Tricolor' }
];

// Definir el orden de categorías
const ordenCategorias = ['Foliages', 'Tropical Flowers'];

// Definir categorías excluidas
const excludedCategories = ['Hydrangeas'];

// Definir nombres de productos a excluir
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

// Función para obtener productos de Ecwid
async function fetchEcwidProducts() {
    try {
        const storeId = process.env.ECWID_STORE_ID;
        const apiToken = process.env.ECWID_API_TOKEN;
        const response = await axios.get(`https://app.ecwid.com/api/v3/${storeId}/products`, {
            headers: {
                'Authorization': `Bearer ${apiToken}`
            },
            params: {
                limit: 100,
                offset: 0
            }
        });
        console.log('Respuesta de la API de Ecwid:', JSON.stringify(response.data, null, 2));
        return response.data.items;
    } catch (error) {
        console.error('Error al obtener productos de Ecwid:', error.response ? error.response.data : error.message);
        return [];
    }
}

// Función para obtener la configuración del store
async function fetchStoreSettings() {
    try {
        const storeId = process.env.ECWID_STORE_ID;
        const apiToken = process.env.ECWID_API_TOKEN;
        const response = await axios.get(`https://app.ecwid.com/api/v3/${storeId}/settings`, {
            headers: {
                'Authorization': `Bearer ${apiToken}`
            }
        });
        console.log('Store Settings:', JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (error) {
        console.error('Error al obtener la configuración del store:', error.response ? error.response.data : error.message);
        return null;
    }
}

// Función para ordenar los productos
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
            productosRestantes.splice(index, 1);
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
    productosRestantes.sort((a, b) => a.name.localeCompare(b.name));
    productosOrdenados.push(...productosRestantes);

    return productosOrdenados;
}

// Función para generar HTML de los productos sin la columna de precios
function generateProductsHTML(products) {
  if (products.length === 0) {
      return '<p>No hay productos disponibles en este momento.</p>';
  }

  let html = `
      <h2>Productos Disponibles:</h2>
      <table>
          <tr>
              <th>Imagen</th>
              <th>Nombre</th>
              <th>Ver Producto</th>
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
              <td><a href="${productUrl}" target="_blank">Ver Producto</a></td>
          </tr>
      `;
  });
  
  html += '</table>';
  return html;
}

// Función para enviar correo de agradecimiento
async function sendThankYouEmail(toEmail, clientData = {}) {
  try {
      const templatePath = path.join(__dirname, 'views', 'thank-you.html');
      let htmlContent = fs.readFileSync(templatePath, 'utf-8');

      // Reemplazar los placeholders con los datos correspondientes
      htmlContent = htmlContent.replace('{{logo}}', clientData.logoURL || 'https://firebasestorage.googleapis.com/v0/b/formulario-531b6.appspot.com/o/logo.jpeg?alt=media&token=202ee807-bd5c-44ac-9b1e-ce443cb11837');

      // Verificar si es una adición manual o julian y reemplazar los campos adicionales
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

// Función para asegurar que la URL tenga un protocolo
function ensureUrlProtocol(url) {
    if (!/^https?:\/\//i.test(url)) {
        return 'http://' + url;
    }
    return url;
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

// Ruta POST para extraer el texto de la imagen (Agregar por Tarjeta)
app.post('/extract', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'logo', maxCount: 1 }]), async (req, res) => {
  try {
    console.log('POST /extract - Iniciando extracción de texto');

    const files = req.files;

    // Validar que se haya subido una imagen para escaneo de texto
    if (!files['image'] || files['image'].length === 0) {
      console.warn('POST /extract - No se subió ninguna imagen para extracción de texto');
      return res.status(400).json({ error: 'No se subió ninguna imagen para extracción de texto.' });
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

      // Hacer el archivo público
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
  } catch (error) {
    console.error('POST /extract - Error durante la extracción de texto:', error);
    res.status(500).json({ error: 'Hubo un error al extraer el texto de la imagen.' });
  }
});

// Ruta POST para guardar los datos en Firestore (Agregar por Tarjeta)
app.post('/upload', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'logo', maxCount: 1 }]), async (req, res) => {
  try {
    console.log('POST /upload - Iniciando proceso de agregación por tarjeta');

    const { extractedText, additionalNotes, email_card } = req.body;
    const files = req.files;

    // Validar que se haya proporcionado el texto extraído
    if (!extractedText) {
      console.warn('POST /upload - No se proporcionó texto extraído');
      return res.status(400).json({ error: 'No se proporcionó texto extraído.' });
    }

    // Validar que se haya proporcionado el email
    if (!email_card) {
      console.warn('POST /upload - No se proporcionó el email');
      return res.status(400).json({ error: 'El correo electrónico es requerido.' });
    }

    // Validar el formato del email en el servidor
    if (!validator.isEmail(email_card)) {
      console.warn('POST /upload - Formato de email inválido:', email_card);
      return res.status(400).json({ error: 'Formato de correo electrónico inválido.' });
    }

    let logoURL = '';

    // Si se ha subido un logo, procesarlo
    if (files['logo'] && files['logo'].length > 0) {
      const logoFile = files['logo'][0];
      const logoPath = logoFile.path;
      const logoFileName = `logos/${Date.now()}_${logoFile.originalname}`;
      const file = bucket.file(logoFileName);

      console.log(`POST /upload - Subiendo logo: ${logoPath} a ${logoFileName}`);

      // Subir el logo a Firebase Storage
      await bucket.upload(logoPath, {
        destination: logoFileName,
        metadata: {
          contentType: logoFile.mimetype,
        },
      });

      console.log(`POST /upload - Logo subido a Firebase Storage: ${logoFileName}`);

      // Hacer el archivo público
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
      email: email_card.trim(),
      extractedText: extractedText.trim(),
      additionalNotes: additionalNotes || '',
      submissionDate: admin.firestore.FieldValue.serverTimestamp(),
      logoURL: logoURL,
      priority: 0 // prioridad por defecto
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
        if (!product.categories) return true;
        return !product.categories.some(cat => excludedCategories.includes(cat.name));
    });

    // Filtrar productos para excluir los nombres especificados en excludedProductNames
    filteredProducts = filteredProducts.filter(product => {
        if (!product.name) return true;
        return !excludedProductNames.includes(product.name.trim());
    });

    filteredProducts = ordenarProductos(filteredProducts, productosPrioritarios, ordenCategorias);
    const productsHTML = generateProductsHTML(filteredProducts);

    await sendThankYouEmail(email_card, {
      logoURL: logoURL,
      productsHTML: productsHTML
    });

    // Responder con éxito
    res.json({ message: 'Formulario enviado exitosamente.' });
    console.log('POST /upload - Respuesta enviada con éxito');
  } catch (error) {
    console.error('POST /upload - Error al guardar los datos:', error);
    res.status(500).json({ error: 'Hubo un error al guardar tus datos.' });
  }
});

// Ruta POST para guardar los datos manualmente en Firestore (Agregar Manualmente)
app.post('/uploadManual', upload.fields([{ name: 'logo_manual', maxCount: 1 }]), async (req, res) => {
  try {
    console.log('POST /uploadManual - Iniciando proceso de agregación manual');

    const { email_manual, name, phone, additionalNotes_manual } = req.body;
    const files = req.files;

    // Log para verificar el contenido de req.body
    console.log('POST /uploadManual - req.body:', req.body);
    console.log('POST /uploadManual - req.files:', req.files);

    // Validar que se haya proporcionado el email
    if (!email_manual) {
      console.warn('POST /uploadManual - No se proporcionó el email');
      return res.status(400).json({ error: 'El correo electrónico es requerido.' });
    }

    // Validar el formato del email
    if (!validator.isEmail(email_manual)) {
      console.warn('POST /uploadManual - Formato de email inválido:', email_manual);
      return res.status(400).json({ error: 'Formato de correo electrónico inválido.' });
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

      // Hacer el archivo público
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
      logoURL: logoURL,
      priority: 0 // prioridad por defecto
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
    res.json({ message: 'Formulario manual enviado exitosamente.' });
    console.log('POST /uploadManual - Respuesta enviada con éxito');
  } catch (error) {
    console.error('POST /uploadManual - Error al guardar los datos manuales:', error);
    res.status(500).json({ error: 'Hubo un error al guardar tus datos manuales.' });
  }
});

// Ruta POST para guardar los datos en Firestore (Agregar Tarjeta Julian)
app.post('/uploadJulian', upload.fields([{ name: 'logo_julian', maxCount: 1 }]), async (req, res) => {
  try {
    console.log('POST /uploadJulian - Iniciando proceso de agregación Tarjeta Julian');

    const { email_julian, name_julian, phone_julian, additionalNotes_julian } = req.body;
    const files = req.files;

    // Log para verificar el contenido de req.body y req.files
    console.log('POST /uploadJulian - req.body:', req.body);
    console.log('POST /uploadJulian - req.files:', req.files);

    // Validar que se haya proporcionado el email
    if (!email_julian) {
      console.warn('POST /uploadJulian - No se proporcionó el email');
      return res.status(400).json({ error: 'El correo electrónico es requerido.' });
    }

    // Validar el formato del email
    if (!validator.isEmail(email_julian)) {
      console.warn('POST /uploadJulian - Formato de email inválido:', email_julian);
      return res.status(400).json({ error: 'Formato de correo electrónico inválido.' });
    }

    let logoURL = '';

    // Si se ha subido un logo, procesarlo
    if (files['logo_julian'] && files['logo_julian'].length > 0) {
      const logoFile = files['logo_julian'][0];
      const logoPath = logoFile.path;
      const logoFileName = `julianLogos/${Date.now()}_${logoFile.originalname}`;
      const file = bucket.file(logoFileName);

      console.log(`POST /uploadJulian - Subiendo logo: ${logoPath} a ${logoFileName}`);

      // Subir el logo a Firebase Storage
      await bucket.upload(logoPath, {
        destination: logoFileName,
        metadata: {
          contentType: logoFile.mimetype,
        },
      });

      console.log(`POST /uploadJulian - Logo subido a Firebase Storage: ${logoFileName}`);

      // Hacer el archivo público
      await file.makePublic();
      console.log(`POST /uploadJulian - Logo hecho público: ${logoFileName}`);

      // Obtener la URL pública
      logoURL = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
      console.log(`POST /uploadJulian - URL pública del logo: ${logoURL}`);

      // Eliminar el archivo temporal del servidor después de subir
      fs.unlinkSync(logoPath);
      console.log(`POST /uploadJulian - Archivo temporal del logo eliminado: ${logoPath}`);
    }

    // Crear una nueva entrada de cliente julian con los datos recibidos
    const julianClient = {
      email: email_julian.trim(),
      name: name_julian ? name_julian.trim() : '',
      phone: phone_julian ? phone_julian.trim() : '',
      additionalNotes: additionalNotes_julian || '',
      submissionDate: admin.firestore.FieldValue.serverTimestamp(),
      logoURL: logoURL,
      priority: 0 // prioridad por defecto
    };

    console.log('POST /uploadJulian - Datos del cliente julian a guardar:', julianClient);

    // Guardar el documento en Firestore en la colección 'julianClients'
    const docRef = await db.collection('julianClients').add(julianClient);
    console.log(`POST /uploadJulian - Cliente julian agregado con ID: ${docRef.id}`);

    // Enviar el correo de agradecimiento usando la misma plantilla
    await sendThankYouEmail(email_julian, {
      logoURL: logoURL,
      name: julianClient.name,
      phone: julianClient.phone,
      additionalNotes: julianClient.additionalNotes
    });

    // Responder con éxito
    res.json({ message: 'Formulario Julian enviado exitosamente.' });
    console.log('POST /uploadJulian - Respuesta enviada con éxito');
  } catch (error) {
    console.error('POST /uploadJulian - Error al guardar los datos julian:', error);
    res.status(500).json({ error: 'Hubo un error al guardar tus datos Julian.' });
  }
});

// Ruta POST para agregar Cliente Mayorista
app.post('/admin/addWholesale', async (req, res) => {
    try {
        const { name, contact, company, website, email, country, observations } = req.body;

        // Validar que se haya proporcionado el email
        if (!email) {
            return res.status(400).json({ error: 'El correo electrónico es requerido.' });
        }

        // Validar el formato del email
        if (!validator.isEmail(email)) {
            return res.status(400).json({ error: 'Formato de correo electrónico inválido.' });
        }

        // Crear una nueva entrada de cliente mayorista con los datos recibidos
        const wholesaleClient = {
            name: name.trim(),
            contact: contact.trim(),
            company: company.trim(),
            website: website.trim(),
            email: email.trim(),
            country: country.trim(),
            observations: observations.trim(),
            submissionDate: admin.firestore.FieldValue.serverTimestamp(),
            priority: 0 // prioridad por defecto
        };

        console.log('POST /admin/addWholesale - Datos del cliente mayorista a guardar:', wholesaleClient);

        // Guardar el documento en Firestore en la colección 'wholesaleClients'
        const docRef = await db.collection('wholesaleClients').add(wholesaleClient);
        console.log(`POST /admin/addWholesale - Cliente mayorista agregado con ID: ${docRef.id}`);

        // Responder con éxito
        res.json({ message: 'Cliente Mayorista agregado con éxito.' });
    } catch (error) {
        console.error('POST /admin/addWholesale - Error al agregar Cliente Mayorista:', error);
        res.status(500).json({ error: 'Hubo un error al agregar el Cliente Mayorista.' });
    }
});

// Ruta POST para agregar Cliente Masivo
app.post('/admin/addMassive', async (req, res) => {
    try {
        const { name, contact, company, website, email, country, observations } = req.body;

        // Validar que se haya proporcionado el email
        if (!email) {
            return res.status(400).json({ error: 'El correo electrónico es requerido.' });
        }

        // Validar el formato del email
        if (!validator.isEmail(email)) {
            return res.status(400).json({ error: 'Formato de correo electrónico inválido.' });
        }

        // Crear una nueva entrada de cliente masivo con los datos recibidos
        const massiveClient = {
            name: name.trim(),
            contact: contact.trim(),
            company: company.trim(),
            website: website.trim(),
            email: email.trim(),
            country: country.trim(),
            observations: observations.trim(),
            submissionDate: admin.firestore.FieldValue.serverTimestamp(),
            priority: 0 // prioridad por defecto
        };

        console.log('POST /admin/addMassive - Datos del cliente masivo a guardar:', massiveClient);

        // Guardar el documento en Firestore en la colección 'massiveClients'
        const docRef = await db.collection('massiveClients').add(massiveClient);
        console.log(`POST /admin/addMassive - Cliente masivo agregado con ID: ${docRef.id}`);

        // Responder con éxito
        res.json({ message: 'Cliente Masivo agregado con éxito.' });
    } catch (error) {
        console.error('POST /admin/addMassive - Error al agregar Cliente Masivo:', error);
        res.status(500).json({ error: 'Hubo un error al agregar el Cliente Masivo.' });
    }
});

// Ruta GET para la página administrativa (protegido con autenticación básica)
app.use(
  '/admin',
  basicAuth({
    users: { admin: process.env.ADMIN_PASS || '1234' },
    challenge: true,
    realm: 'Administración de Firestore',
  })
);

// Ruta GET para la página administrativa
app.get('/admin', async (req, res) => {
  try {
    console.log('GET /admin - Accediendo al panel administrativo');

    // Obtener clientes agregados por tarjeta ordenados por prioridad y fecha
    const snapshotClients = await db.collection('clients').orderBy('priority', 'desc').orderBy('submissionDate', 'desc').get();
    const clients = [];
    snapshotClients.forEach((doc) => {
      clients.push({ id: doc.id, ...doc.data() });
    });
    console.log(`GET /admin - Clientes por tarjeta obtenidos: ${clients.length}`);
    console.log('Datos de clientes por tarjeta:', clients);

    // Obtener clientes agregados manualmente ordenados por prioridad y fecha
    const snapshotManualClients = await db.collection('manualClients').orderBy('priority', 'desc').orderBy('submissionDate', 'desc').get();
    const manualClients = [];
    snapshotManualClients.forEach((doc) => {
      manualClients.push({ id: doc.id, ...doc.data() });
    });
    console.log(`GET /admin - Clientes manuales obtenidos: ${manualClients.length}`);
    console.log('Datos de clientes manuales:', manualClients);

    // Obtener clientes agregados Julian ordenados por prioridad y fecha
    const snapshotJulianClients = await db.collection('julianClients').orderBy('priority', 'desc').orderBy('submissionDate', 'desc').get();
    const julianClients = [];
    snapshotJulianClients.forEach((doc) => {
      julianClients.push({ id: doc.id, ...doc.data() });
    });
    console.log(`GET /admin - Clientes Julian obtenidos: ${julianClients.length}`);
    console.log('Datos de clientes Julian:', julianClients);

    // Obtener clientes Mayoristas ordenados por fecha
    const snapshotWholesaleClients = await db.collection('wholesaleClients').orderBy('submissionDate', 'desc').get();
    const wholesaleClients = [];
    snapshotWholesaleClients.forEach((doc) => {
      wholesaleClients.push({ id: doc.id, ...doc.data() });
    });
    console.log(`GET /admin - Clientes Mayoristas obtenidos: ${wholesaleClients.length}`);
    console.log('Datos de clientes Mayoristas:', wholesaleClients);

    // Obtener clientes Masivo ordenados por fecha
    const snapshotMassiveClients = await db.collection('massiveClients').orderBy('submissionDate', 'desc').get();
    const massiveClients = [];
    snapshotMassiveClients.forEach((doc) => {
      massiveClients.push({ id: doc.id, ...doc.data() });
    });
    console.log(`GET /admin - Clientes Masivo obtenidos: ${massiveClients.length}`);
    console.log('Datos de clientes Masivo:', massiveClients);

    res.render('admin', { clients, manualClients, julianClients, wholesaleClients, massiveClients });
    console.log('GET /admin - Página administrativa renderizada con éxito');
  } catch (error) {
    console.error('GET /admin - Error al obtener los clientes:', error);
    res.status(500).send('Hubo un error al obtener los datos.');
  }
});

// Ruta POST para eliminar documentos
app.post('/admin/delete', async (req, res) => {
    try {
        const { id, collection } = req.body;
        if (!id || !collection) {
            return res.status(400).json({ error: 'ID y colección son requeridos.' });
        }
        await db.collection(collection).doc(id).delete();
        console.log(`Documento con ID ${id} eliminado de la colección ${collection}.`);
        res.json({ message: 'Documento eliminado con éxito.' });
    } catch (error) {
        console.error('Error al eliminar el documento:', error);
        res.status(500).json({ error: 'Error al eliminar el documento.' });
    }
});

// Ruta GET para mostrar el formulario de edición
app.get('/admin/edit', async (req, res) => {
    try {
        const { id, collection } = req.query;
        if (!id || !collection) {
            return res.status(400).send('ID y colección son requeridos.');
        }
        const docRef = db.collection(collection).doc(id);
        const doc = await docRef.get();
        if (!doc.exists) {
            return res.status(404).send('Documento no encontrado.');
        }
        const data = { id: doc.id, ...doc.data() };
        res.render('edit', { data, collection });
    } catch (error) {
        console.error('Error al obtener el documento para editar:', error);
        res.status(500).send('Error al obtener el documento para editar.');
    }
});

// Ruta POST para actualizar el documento
app.post('/admin/edit', upload.single('logo'), async (req, res) => {
    try {
        const { id, collection, email, name, phone, contact, company, website, country, observations, extractedText, additionalNotes, priority } = req.body;
        const file = req.file;

        if (!id || !collection || !email) {
            return res.status(400).send('ID, colección y email son requeridos.');
        }

        const docRef = db.collection(collection).doc(id);

        // Preparar los datos para actualizar
        const updateData = {
            email: email.trim(),
        };

        // Manejar campos específicos según la colección
        if (collection === 'clients') {
            updateData.extractedText = extractedText || '';
            updateData.additionalNotes = additionalNotes || '';
            updateData.priority = priority ? parseInt(priority) : 0;
        } else if (collection === 'julianClients' || collection === 'manualClients') {
            updateData.name = name || '';
            updateData.phone = phone || '';
            updateData.additionalNotes = additionalNotes || '';
            updateData.priority = priority ? parseInt(priority) : 0;
        } else if (collection === 'wholesaleClients' || collection === 'massiveClients') {
            updateData.name = name || '';
            updateData.contact = contact || '';
            updateData.company = company || '';
            updateData.website = website ? website.trim() : '';
            updateData.country = country || '';
            updateData.observations = observations || '';
            // No se incluye 'priority' ni 'additionalNotes' ni 'logo'
        }

        // Si se ha subido un nuevo logo y la colección lo soporta
        if (file && (collection === 'clients' || collection === 'julianClients' || collection === 'manualClients')) {
            const logoPath = file.path;
            const logoFileName = `${collection}Logos/${Date.now()}_${file.originalname}`;
            const firebaseFile = bucket.file(logoFileName);

            // Subir el nuevo logo a Firebase Storage
            await bucket.upload(logoPath, {
                destination: logoFileName,
                metadata: {
                    contentType: file.mimetype,
                },
            });

            // Hacer el archivo público
            await firebaseFile.makePublic();

            // Obtener la URL pública
            const logoURL = `https://storage.googleapis.com/${bucket.name}/${firebaseFile.name}`;

            // Eliminar el archivo temporal
            fs.unlinkSync(logoPath);

            // Actualizar el logoURL en los datos
            updateData.logoURL = logoURL;
        }

        // Actualizar el documento en Firestore
        await docRef.update(updateData);

        console.log(`Documento con ID ${id} actualizado en la colección ${collection}.`);

        res.redirect('/admin');
    } catch (error) {
        console.error('Error al actualizar el documento:', error);
        res.status(500).send('Error al actualizar el documento.');
    }
});

// Middleware de manejo de errores generales
app.use((err, req, res, next) => {
  console.error('Middleware de Error General - Error capturado:', err);
  
  if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
    return res.status(500).json({ error: 'Hubo un error al procesar tu solicitud.' });
  } else {
    return res.status(500).send('Hubo un error al procesar tu solicitud.');
  }
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});
