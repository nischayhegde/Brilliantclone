import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'

// Firebase web config is PUBLIC (safe in client bundles). Security is enforced by
// Firestore rules + enabled auth providers, not by keeping these secret.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

for (const [key, value] of Object.entries(firebaseConfig)) {
  if (!value) {
    throw new Error(
      `Missing Firebase env (${key}). Copy .env.example to .env.local and fill in the web config.`,
    )
  }
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()

// Callable Cloud Functions client. The OpenAI key never reaches the client — the
// `composeScenario`/`gradeRun` callables run the model server-side behind auth + rate limits.
export const functions = getFunctions(app)

// Local development against the Functions emulator is OPT-IN (set VITE_USE_EMULATORS=true
// in .env.local and run `firebase emulators:start`). We don't auto-connect in every dev
// session because the app normally talks to the real (deployed) backend in dev too, and
// pointing at a non-running emulator would needlessly fail every AI call (it would still
// degrade gracefully to curated-only, but the opt-in keeps the default dev experience
// clean). The Functions emulator default port is 5001.
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
}
