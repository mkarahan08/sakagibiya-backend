import express from "express";
import {
  addToFavorites,
  removeFromFavorites,
  getUserFavorites,
  toggleFavorite,
  checkFavoriteStatus
} from "../controllers/favoriteController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Tüm route'lar authentication gerektirir
router.post("/add", protect, addToFavorites);
router.delete("/remove/:productId", protect, removeFromFavorites);
router.get("/", protect, getUserFavorites);
router.post("/toggle", protect, toggleFavorite);
router.get("/check/:productId", protect, checkFavoriteStatus);

export default router;

