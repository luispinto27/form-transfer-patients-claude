/**
 * Verificación de firestore.rules contra el emulador de Firestore.
 *
 * Las reglas son lo único que protege los datos clínicos: la aplicación no
 * tiene login y el config de Firebase viaja en el bundle del navegador. Así que
 * no basta con leerlas, hay que atacarlas.
 *
 *   npm run test:rules
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

const AUTORIZACION = '99887766';

/** Las 8 secciones que el formulario envía. */
const datos = {
  traslado: { autorizacionNumero: AUTORIZACION },
  paciente: { nombreCompleto: 'Juan Pérez' },
  antecedentes: {},
  signos: [],
  examen: {},
  gastos: [],
  conducta: {},
  firmas: {}
};

const indiceValido = () => ({ autorizacion: AUTORIZACION, registradoEn: serverTimestamp() });
const registroValido = () => ({
  autorizacion: AUTORIZACION,
  registradoEn: serverTimestamp(),
  payload: { datos }
});

const env = await initializeTestEnvironment({
  projectId: 'ambulancias-247-traslados',
  firestore: {
    rules: readFileSync('firestore.rules', 'utf8'),
    host: '127.0.0.1',
    port: 8080
  }
});

/** Siembra un registro saltándose las reglas, como lo haría la consola. */
async function sembrar(autorizacion = AUTORIZACION) {
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'traslados_index', autorizacion), {
      autorizacion,
      registradoEn: Timestamp.now()
    });
    await setDoc(doc(db, 'traslados', autorizacion), {
      autorizacion,
      registradoEn: Timestamp.now(),
      payload: { datos }
    });
  });
}

const casos = [];
function caso(nombre, fn) {
  casos.push({ nombre, fn });
}

const db = () => env.unauthenticatedContext().firestore();

// ---------------------------------------------------------------
// Lo que la aplicación necesita poder hacer
// ---------------------------------------------------------------

caso('el navegador puede consultar el índice por número de autorización', async () => {
  await sembrar();
  await assertSucceeds(getDoc(doc(db(), 'traslados_index', AUTORIZACION)));
});

caso('el navegador puede crear el índice y el registro', async () => {
  const cliente = db();
  await assertSucceeds(setDoc(doc(cliente, 'traslados_index', AUTORIZACION), indiceValido()));
  await assertSucceeds(setDoc(doc(cliente, 'traslados', AUTORIZACION), registroValido()));
});

// ---------------------------------------------------------------
// Privacidad: los datos clínicos no salen por la web
// ---------------------------------------------------------------

caso('NO puede leer el registro clínico completo', async () => {
  await sembrar();
  await assertFails(getDoc(doc(db(), 'traslados', AUTORIZACION)));
});

caso('NO puede listar el índice para enumerar todas las autorizaciones', async () => {
  await sembrar();
  await assertFails(getDocs(collection(db(), 'traslados_index')));
});

caso('NO puede listar los registros clínicos', async () => {
  await sembrar();
  await assertFails(getDocs(collection(db(), 'traslados')));
});

// ---------------------------------------------------------------
// El candado contra duplicados
// ---------------------------------------------------------------

caso('NO puede sobrescribir un registro ya existente', async () => {
  await sembrar();
  await assertFails(setDoc(doc(db(), 'traslados', AUTORIZACION), registroValido()));
});

caso('NO puede sobrescribir un índice ya existente', async () => {
  await sembrar();
  await assertFails(setDoc(doc(db(), 'traslados_index', AUTORIZACION), indiceValido()));
});

caso('NO puede borrar el índice para desbloquearse a sí mismo', async () => {
  await sembrar();
  await assertFails(deleteDoc(doc(db(), 'traslados_index', AUTORIZACION)));
});

caso('NO puede borrar el registro clínico', async () => {
  await sembrar();
  await assertFails(deleteDoc(doc(db(), 'traslados', AUTORIZACION)));
});

// ---------------------------------------------------------------
// Integridad del esquema
// ---------------------------------------------------------------

caso('NO puede añadir campos arbitrarios al registro', async () => {
  await assertFails(
    setDoc(doc(db(), 'traslados', AUTORIZACION), { ...registroValido(), inyectado: 'x' })
  );
});

caso('NO puede fechar el registro a su antojo', async () => {
  await assertFails(
    setDoc(doc(db(), 'traslados', AUTORIZACION), {
      ...registroValido(),
      registradoEn: Timestamp.fromDate(new Date('2020-01-01'))
    })
  );
});

caso('NO puede guardar un registro bajo un ID distinto a su autorización', async () => {
  await assertFails(
    setDoc(doc(db(), 'traslados', 'otro-numero'), registroValido())
  );
});

caso('NO puede colar secciones desconocidas, como el PDF en base64', async () => {
  await assertFails(
    setDoc(doc(db(), 'traslados', AUTORIZACION), {
      ...registroValido(),
      payload: { datos: { ...datos, pdfHistoria: 'JVBERi0xLjQK' } }
    })
  );
});

caso('NO puede escribir una autorización desmesurada', async () => {
  const largo = '9'.repeat(200);
  await assertFails(
    setDoc(doc(db(), 'traslados_index', largo), {
      autorizacion: largo,
      registradoEn: serverTimestamp()
    })
  );
});

caso('NO puede omitir campos requeridos', async () => {
  await assertFails(
    setDoc(doc(db(), 'traslados_index', AUTORIZACION), { autorizacion: AUTORIZACION })
  );
});

caso('NO puede escribir en colecciones ajenas al diseño', async () => {
  await assertFails(setDoc(doc(db(), 'otra_coleccion', 'x'), { a: 1 }));
  await assertFails(getDoc(doc(db(), 'otra_coleccion', 'x')));
});

// ---------------------------------------------------------------

let fallos = 0;
for (const { nombre, fn } of casos) {
  await env.clearFirestore();
  try {
    await fn();
    console.log(`  ✓ ${nombre}`);
  } catch (error) {
    fallos++;
    console.error(`  ✗ ${nombre}\n    ${error?.message ?? error}`);
  }
}

await env.cleanup();

console.log(`\n${casos.length - fallos}/${casos.length} comprobaciones de reglas pasaron`);
assert.equal(fallos, 0, `${fallos} comprobación(es) de reglas fallaron`);
