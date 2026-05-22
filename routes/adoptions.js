const express = require("express");
const { ObjectId } = require("mongodb");
const verifyToken = require("../middleware/verifyToken");

module.exports = (adoptionRequestsCollection, petsCollection) => {
  const router = express.Router();

  // POST /api/adoptions  →  submit adoption request (private)
  router.post("/", verifyToken, async (req, res) => {
    try {
      const { petId, petName, pickupDate, message } = req.body;
      const { email: userEmail, name: userName } = req.user;

      // Check if already requested
      const existing = await adoptionRequestsCollection.findOne({
        petId,
        userEmail,
      });
      if (existing) {
        return res
          .status(400)
          .json({ message: "You already requested this pet." });
      }

      const request = {
        petId,
        petName,
        userName: req.body.userName,
        userEmail,
        pickupDate,
        message,
        status: "pending",
        createdAt: new Date(),
      };
      const result = await adoptionRequestsCollection.insertOne(request);
      res.status(201).json({ insertedId: result.insertedId });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  });

  // GET /api/adoptions/my-requests  →  user's own requests (private)
  router.get("/my-requests", verifyToken, async (req, res) => {
    try {
      const requests = await adoptionRequestsCollection
        .find({ userEmail: req.user.email })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(requests);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  });

  // GET /api/adoptions/pet/:petId  →  requests for a specific pet (owner)
  router.get("/pet/:petId", verifyToken, async (req, res) => {
    try {
      const pet = await petsCollection.findOne({
        _id: new ObjectId(req.params.petId),
      });
      if (!pet) return res.status(404).json({ message: "Pet not found" });
      if (pet.ownerEmail !== req.user.email) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const requests = await adoptionRequestsCollection
        .find({ petId: req.params.petId })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(requests);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  });

  // PATCH /api/adoptions/:id/approve  →  approve request (owner)
  router.patch("/:id/approve", verifyToken, async (req, res) => {
    try {
      const request = await adoptionRequestsCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      if (!request) return res.status(404).json({ message: "Request not found" });

      // Verify pet owner
      const pet = await petsCollection.findOne({
        _id: new ObjectId(request.petId),
      });
      if (!pet || pet.ownerEmail !== req.user.email) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Approve this request
      await adoptionRequestsCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { status: "approved" } }
      );

      // Reject all other requests for this pet
      await adoptionRequestsCollection.updateMany(
        {
          petId: request.petId,
          _id: { $ne: new ObjectId(req.params.id) },
        },
        { $set: { status: "rejected" } }
      );

      // Mark pet as adopted
      await petsCollection.updateOne(
        { _id: new ObjectId(request.petId) },
        { $set: { adopted: true } }
      );

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  });

  // PATCH /api/adoptions/:id/reject  →  reject single request (owner)
  router.patch("/:id/reject", verifyToken, async (req, res) => {
    try {
      const result = await adoptionRequestsCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { status: "rejected" } }
      );
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  });

  // DELETE /api/adoptions/:id  →  cancel own request
  router.delete("/:id", verifyToken, async (req, res) => {
    try {
      const request = await adoptionRequestsCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      if (!request) return res.status(404).json({ message: "Not found" });
      if (request.userEmail !== req.user.email) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const result = await adoptionRequestsCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  });

  return router;
};
