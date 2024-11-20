// updatePriority.js

const admin = require('firebase-admin');
const serviceAccount = require('./formulario-531b6-firebase-adminsdk-1z5gl-dd144b687f.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'formulario-531b6.appspot.com',
});

const db = admin.firestore();

const collections = ['clients', 'manualClients', 'julianClients'];

async function updatePriorityField() {
  try {
    for (const collection of collections) {
      const snapshot = await db.collection(collection).get();
      console.log(`Actualizando colección: ${collection}`);
      const batch = db.batch();
      let count = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        if (!('priority' in data)) {
          batch.update(doc.ref, { priority: 0 });
          count++;
        }
      });
      if (count > 0) {
        await batch.commit();
        console.log(`Actualizados ${count} documentos en la colección ${collection}.`);
      } else {
        console.log(`No se encontraron documentos sin el campo 'priority' en la colección ${collection}.`);
      }
    }
    console.log('Actualización completada.');
  } catch (error) {
    console.error('Error al actualizar los documentos:', error);
  }
}

updatePriorityField();
