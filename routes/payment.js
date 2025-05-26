const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  createPaymentIntent,
  confirmPayment,
  handleWebhook,
} = require("../controllers/payment");

// Protected routes (require authentication)
router.post("/create-payment-intent", protect, createPaymentIntent);
router.post("/confirm", protect, confirmPayment);

// Public route for Stripe webhook
// Note: Stripe webhook needs raw body, so this route should be configured differently
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook
);

module.exports = router;
