
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
const allowedOrigins = [
    productionUrl, 
    "https://nano-hr.web.app", 
    "http://localhost:4200",
    "http://localhost:3000",
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:4200",
    "http://127.0.0.1:8080",
    // Flutter web development origins
    "http://localhost:5000",
    "http://127.0.0.1:5000",
    "http://localhost:8000",
    "http://127.0.0.1:8000"
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, Flutter web, or curl requests)
        if (!origin) return callback(null, true);
        
        // Check if origin is in allowed list
        if (allowedOrigins.indexOf(origin) !== -1) {
            return callback(null, true);
        }
        
        // For development, allow localhost with any port
        if (process.env.NODE_ENV !== 'production') {
            if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
                return callback(null, true);
            }
        }
        
        console.log('CORS blocked origin:', origin);
        return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
        "Content-Type", 
        "Authorization", 
        "X-Requested-With",
        "Accept",
        "Origin",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers"
    ],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

app.options('*', cors());

// Additional CORS headers for Flutter web compatibility
app.use((req, res, next) => {
    // Set CORS headers for all responses
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    next();
});

app.use(express.json());


app.use("/auth", authRoutes);
app.use("/employee", employeeRoutes);
app.use("/line", lineRoutes);
app.use("/resignation", resignationRoutes);



module.exports = app;
