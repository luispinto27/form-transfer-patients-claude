export const environment = {
  production: false,
  apiUrl: 'http://localhost:5142/api',
  servicioApiUrl: '/index.php',
  servicioUsuario: 'historiaClinica',
  servicioPassword: '4536905-8a3deb23',
  // Bitácora de traslados ya registrados (ver firestore.rules).
  // El config web de Firebase es público por diseño: viaja en el bundle del
  // navegador de todas formas. Lo que protege los datos son las reglas, no el
  // secreto de estos valores.
  firebase: {
    apiKey: 'AIzaSyBufVftLKDfpgjhyivl5lexmt8siXRER7g',
    authDomain: 'ambulancias-247-traslados.firebaseapp.com',
    projectId: 'ambulancias-247-traslados',
    storageBucket: 'ambulancias-247-traslados.firebasestorage.app',
    messagingSenderId: '439502082663',
    appId: '1:439502082663:web:76ac31fb9e150a7806fac2'
  }
};
