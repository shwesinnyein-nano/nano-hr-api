
const { db, admin } = require("./config/firebaseConfig");

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const lineRoutes = require("./routes/lineRoutes");
const resignationRoutes = require("./routes/resignationRoutes");


const app = express();


const allowedOrigin = process.env.NODE_ENV === 'production'
    ? process.env.PRODUCTION_FRONTEND_URL // e.g., "https://your-production-domain.com"
     : "http://localhost:4200";

// app.use(cors({
//   origin: allowedOrigin,
//   methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"],
// }));

// const productionUrl = process.env.PRODUCTION_FRONTEND_URL || "https://nano-hr.web.app";
// console.log("production url", productionUrl)
// const allowedOrigins = [productionUrl, "https://nano-hr.web.app"];

const productionUrl = process.env.PRODUCTION_FRONTEND_URL || "https://nano-hr.web.app";
const allowedOrigins = [productionUrl, "https://nano-hr.web.app", "http://localhost:4200"];


app.use(cors({
    origin: function (origin, callback) {

        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            return callback(null, true);
        } else {
            return callback(new Error("Not allowed by CORS"));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));

app.options('*', cors());



app.use(express.json());


app.use("/auth", authRoutes);
app.use("/employee", employeeRoutes);
app.use("/line", lineRoutes);
app.use("/resignation", resignationRoutes);



module.exports = app;
