const express = require("express");
const app = express();
const port = 8550;
const mongoose = require("mongoose");
const router = require("./src/routes/index");
const cors = require("cors");
const path = require('path');
const { startOrderProcessingJob } = require("./src/jobs/orderJobs");
require("dotenv").config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URL);
    console.log("MongoDB connected: ", conn.connection.host);
  } catch (error) {
    console.log(error);
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

app.use(router);
app.use('/deliveria_upload', express.static(path.join(__dirname, 'deliveria_upload')));

connectDB().then(() => {
  app.listen(port, () => {
    console.log(`server is starting at port ${port}`);
    // Start the cron job for processing orders
    startOrderProcessingJob();
  });
});