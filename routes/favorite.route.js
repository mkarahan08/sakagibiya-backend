import express from "express";
import {
  addToFavorites,
  removeFromFavorites,
  getUserFavorites,
  toggleFavorite,
  checkFavoriteStatus
} from "../controllers/favoriteController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validate.js";
import { addFavoriteValidator, productIdParamValidator, toggleFavoriteValidator } from "../validators/favoriteValidator.js";

const router = express.Router();

router.post("/add", protect, addFavoriteValidator, validate, addToFavorites);
router.delete("/remove/:productId", protect, productIdParamValidator, validate, removeFromFavorites);
router.get("/", protect, getUserFavorites);
router.post("/toggle", protect, toggleFavoriteValidator, validate, toggleFavorite);
router.get("/check/:productId", protect, productIdParamValidator, validate, checkFavoriteStatus);

export default router;

