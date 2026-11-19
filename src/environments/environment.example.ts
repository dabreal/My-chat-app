// Plantilla de configuración. NO pongas valores reales en este archivo.
// Cópialo como `environment.ts` (ignorado por git) y rellena los valores
// de tu propio proyecto Firebase (Consola Firebase > Configuración del proyecto > Tus apps).
// Ejecuta `npm run setup:env` para crear la copia automáticamente.

export const environment = {
  production: false,
  firebase: {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
    databaseURL: 'https://YOUR_PROJECT_ID-default-rtdb.YOUR_REGION.firebasedatabase.app',
    projectId: 'YOUR_PROJECT_ID',
    storageBucket: 'YOUR_PROJECT_ID.firebasestorage.app',
    messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
    appId: 'YOUR_APP_ID',
    measurementId: 'YOUR_MEASUREMENT_ID',
  },
};
