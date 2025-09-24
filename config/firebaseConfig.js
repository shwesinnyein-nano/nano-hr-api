

// const admin = require("firebase-admin");

// console.log("admin", admin)
// const firebaseConfig = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
// console.log("firebaseconfig", firebaseConfig)

// if (!admin.apps.length) {
//   admin.initializeApp({
//     credential: admin.credential.cert(firebaseConfig),
//   });
// }
// console.log("Firebase Config:", process.env.FIREBASE_ADMIN_CREDENTIALS);



// module.exports = admin ;

const admin = require("firebase-admin");

console.log("🔄 Firebase Admin initialization starting...");
console.log("Admin apps count:", admin.apps.length);

// Check if FIREBASE_ADMIN_CREDENTIALS exists
if (!process.env.FIREBASE_ADMIN_CREDENTIALS) {
  console.error("❌ FIREBASE_ADMIN_CREDENTIALS environment variable not found");
  throw new Error("FIREBASE_ADMIN_CREDENTIALS environment variable is required");
}

try {
  const firebaseConfig = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
  console.log("✅ Firebase config parsed successfully");
  console.log("Project ID:", firebaseConfig.project_id);
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(firebaseConfig),
      storageBucket: `${firebaseConfig.project_id}.appspot.com`
    });
    console.log("✅ Firebase Admin initialized successfully");
    console.log("Storage bucket:", `${firebaseConfig.project_id}.appspot.com`);
  } else {
    console.log("✅ Firebase Admin already initialized");
  }
} catch (error) {
  console.error("❌ Firebase Admin initialization error:", error);
  throw error;
}


const db = admin.firestore();

db.settings({ experimentalForceLongPolling: true });


module.exports = { admin, db };
