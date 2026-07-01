'use client'

import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'

const firebaseConfig = {
  apiKey:    process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
}

// Prevent re-initialization on hot reload
const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const firebaseAuth = getAuth(app)

// Local dev only — routes Phone Auth to the Firebase Auth Emulator instead of
// real SMS, so it's unaffected by SMS region policy / reCAPTCHA Enterprise.
// Production NODE_ENV is never 'development', so this never runs in prod.
// Run `npx firebase emulators:start --only auth` alongside `npm run dev`.
if (process.env.NODE_ENV === 'development') {
  connectAuthEmulator(firebaseAuth, 'http://127.0.0.1:9099')
}

