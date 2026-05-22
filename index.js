require('dotenv').config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion } = require("mongodb");

const authRoutes = require("./routes/auth");
const petRoutes = require("./routes/pets");
const adoptionRoutes = require("./routes/adoptions");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174"
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// MongoDB Connection
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB!");

    const db = client.db("petAdoptionDB");
    const petsCollection = db.collection("pets");
    const adoptionRequestsCollection = db.collection("adoptionRequests");

    app.use("/api/auth", authRoutes);
    app.use("/api/pets", petRoutes(petsCollection));
    app.use("/api/adoptions", adoptionRoutes(adoptionRequestsCollection, petsCollection));

    app.get("/", (req, res) => {
      res.send("🐾 Pet Adoption Server is Running!");
    });

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
}

run();