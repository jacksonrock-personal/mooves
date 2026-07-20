import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getMessaging } from 'firebase-admin/messaging'

function getAdminApp(): App {
  if (getApps().length) return getApps()[0]


  return initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      // The private key comes in as a JSON string with literal \n — convert them
      privateKey:  process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
  })
}

export const firebaseAdmin = getAuth(getAdminApp())

// Phase 15 Surface B — FCM sender (Web Push). Uses the same service account.
export const firebaseMessaging = getMessaging(getAdminApp())
