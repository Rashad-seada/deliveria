const express = require("express");
const app = express();
const port = 8550;
const mongoose = require("mongoose");
const router = require("./src/routes/index");
const cors = require("cors");
const path = require('path');
require("dotenv").config();
app.use(express.json());

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URL);
    console.log("MongoDB connected: ", conn.connection.host);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));

app.use(express.json({ limit: "100mb" }));

app.use(router);
app.use('/deliveria_upload', express.static(path.join(__dirname, 'deliveria_upload')));

connectDB().then(() => {
  app.listen(port, () => {
    console.log(`server is starting at port ${port}`);
  });
});