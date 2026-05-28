import express from "express";
import { registerUser, loginUser, getUserProfile, updateUserProfile } from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";

// Şifre sıfırlama akışı: controller, validator ve middleware'ler.
import {
  forgotPassword,
  verifyResetCode,
  resetPassword,
} from "../controllers/passwordResetController.js";
import {
  forgotPasswordValidator,
  verifyResetCodeValidator,
  resetPasswordValidator,
} from "../validators/passwordResetValidator.js";
import {
  forgotPasswordEmailLimiter,
  forgotPasswordIpLimiter,
  verifyCodeEmailLimiter,
  verifyCodeIpLimiter,
  resetPasswordIpLimiter,
} from "../middleware/rateLimit.js";
import { noStoreCache } from "../middleware/noStoreCache.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/profile", protect, getUserProfile);
router.patch("/profile", protect, updateUserProfile);

// ---------------------------------------------------------------------------
// Şifre sıfırlama uç noktaları
//
// Middleware sırası (her route için):
//   1) noStoreCache    → Cache-Control: no-store (Req 8.6)
//   2) IP limiter      → DDoS / brute-force kabaca önleme
//   3) Email limiter   → email başına ince granül kısıtlama (forgot/verify)
//   4) Validator       → girdi formatı kontrolü (express-validator)
//   5) Controller      → iş mantığı + servis çağrısı
// ---------------------------------------------------------------------------

router.post(
  "/forgot-password",
  noStoreCache,
  forgotPasswordIpLimiter,
  forgotPasswordEmailLimiter,
  forgotPasswordValidator,
  forgotPassword
);

router.post(
  "/verify-reset-code",
  noStoreCache,
  verifyCodeIpLimiter,
  verifyCodeEmailLimiter,
  verifyResetCodeValidator,
  verifyResetCode
);

router.post(
  "/reset-password",
  noStoreCache,
  resetPasswordIpLimiter,
  resetPasswordValidator,
  resetPassword
);

export default router;
