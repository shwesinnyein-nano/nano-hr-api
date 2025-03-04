const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const authRoutes = require("./routes/authRoutes");
const employeeRoutes = require("./routes/employeeRoutes")
const lineRoutes = require("./routes/lineRoutes")
const {db, admin} = require("./config/firebaseConfig")

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// db.collection("employees").add({ message: "Firestore is connected!" })
//   .then(docRef => console.log("✅ Firestore connected. Test ID:", docRef.id))
//   .catch(error => console.error("❌ Firestore connection error:", error));


app.use("/auth", authRoutes);
app.use("/employee", employeeRoutes)
app.use("/line", lineRoutes)


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));

