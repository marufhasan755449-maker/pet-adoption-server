const express = require("express");
const { ObjectId } = require("mongodb");
const verifyToken = require("../middleware/verifyToken");

module.exports = (petsCollection) => {
  const router = express.Router();

  // GET /api/pets  →  all pets (with search, filter, sort)
  router.get("/", async (req, res) => {
    try {
      const { search, species, sort } = req.query;
      const query = {};

      if (search) {
        query.name = { $regex: search, $options: "i" };
      }
      if (species) {
        query.species = { $in: species.split(",") };
      }

      let cursor = petsCollection.find(query);

      if (sort === "fee_asc") cursor = cursor.sort({ fee: 1 });
      else if (sort === "fee_desc") cursor = cursor.sort({ fee: -1 });
      else if (sort === "name_asc") cursor = cursor.sort({ name: 1 });
      else cursor = cursor.sort({ _id: -1 });

      const pets = await cursor.toArray();
      res.json(pets);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  });

  // GET /api/pets/featured  →  6 featured pets
  router.get("/featured", async (req, res) => {
    try {
      const pets = await petsCollection
        .find({ adopted: false })
        .limit(6)
        .sort({ _id: -1 })
        .toArray();
      res.json(pets);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  });

  // GET /api/pets/my-listings  →  owner's pets (private)
  router.get("/my-listings", verifyToken, async (req, res) => {
    try {
      const email = req.user.email;
      const pets = await petsCollection
        .find({ ownerEmail: email })
        .sort({ _id: -1 })
        .toArray();
      res.json(pets);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  });

  // GET /api/pets/:id  →  single pet
  router.get("/:id", async (req, res) => {
    try {
      const pet = await petsCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      if (!pet) return res.status(404).json({ message: "Pet not found" });
      res.json(pet);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  });

  // POST /api/pets  →  add new pet (private)
  router.post("/", verifyToken, async (req, res) => {
    try {
      const pet = {
        ...req.body,
        adopted: false,
        createdAt: new Date(),
      };
      const result = await petsCollection.insertOne(pet);
      res.status(201).json({ insertedId: result.insertedId });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  });

  // PATCH /api/pets/:id  →  update pet (owner only)
  router.patch("/:id", verifyToken, async (req, res) => {
    try {
      const pet = await petsCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      if (!pet) return res.status(404).json({ message: "Pet not found" });
      if (pet.ownerEmail !== req.user.email) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const { _id, ...updateData } = req.body;
      const result = await petsCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: updateData }
      );
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  });

  // DELETE /api/pets/:id  →  delete pet (owner only)
  router.delete("/:id", verifyToken, async (req, res) => {
    try {
      const pet = await petsCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      if (!pet) return res.status(404).json({ message: "Pet not found" });
      if (pet.ownerEmail !== req.user.email) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const result = await petsCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  });

  return router;
};
