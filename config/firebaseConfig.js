// const admin = require("firebase-admin");
// const serviceAccount = require("./firebase-admin.json")

// admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
// });

// const db = admin.firestore();
// module.exports = { admin, db };

const admin = require("firebase-admin");
const path = require("path");

// Load Firebase service account credentials dynamically
const serviceAccount = require("./firebase-admin.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
 
});

const db = admin.firestore();

module.exports = { admin, db };
