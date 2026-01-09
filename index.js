require("dotenv").config();

const express = require("express");
const app = express();
const port = 8550;
const mongoose = require("mongoose");
const router = require("./src/routes/index");
// Swagger UI
const swaggerRouter = require("./src/routes/swagger");
const cors = require("cors");
const path = require('path');
const { startOrderProcessingJob } = require("./src/jobs/orderJobs");

const connectDB = async () => {
  try {
    // Debug: Log environment variable status
    if (!process.env.MONGO_URL) {
      console.error("ERROR: MONGO_URL environment variable is not defined!");
      process.exit(1);
    }
    
    // Debug: Log masked connection string to verify it's being read
    const maskedUrl = process.env.MONGO_URL.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
    console.log("Attempting to connect to MongoDB:", maskedUrl);
    
    const conn = await mongoose.connect(process.env.MONGO_URL);
    console.log("MongoDB connected: ", conn.connection.host);
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
};

// Whitelist of allowed origins from environment variables, split by comma
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS 
  ? process.env.CORS_ALLOWED_ORIGINS.split(',') 
  : [];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));

app.use(express.json({ limit: "10mb" })); // Increased limit and consolidated

// Serve Swagger UI at /api-docs
app.use(swaggerRouter);

app.use(router);
app.use('/deliveria_upload', express.static(path.join(__dirname, 'deliveria_upload')));

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack); // Log the error stack for debugging
  res.status(err.statusCode || 500).json({
    message: err.message || 'An unexpected error occurred.',
    error: process.env.NODE_ENV === 'production' ? {} : err // Don't expose error details in production
  });
});

connectDB().then(() => {
  app.listen(port, () => {
    console.log(`server is starting at port ${port}`);
    // Print Swagger access URLs
    const swaggerBase = process.env.SWAGGER_BASE_URL || `http://localhost:${port}`;
    console.log(`Swagger UI: ${swaggerBase}/api-docs`);
    console.log(`Swagger JSON: ${swaggerBase}/swagger.json`);
    // Start the cron job for processing orders
    startOrderProcessingJob();
  });
});