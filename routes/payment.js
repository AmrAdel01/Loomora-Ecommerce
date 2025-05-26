const express = require("express");
const router = express.Router();
const { protect, isAdmin } = require("../middleware/authMiddleware");
const {
  createPaymentIntent,
  confirmPayment,
  handleWebhook,
  getPaymentDetails,
  processRefund,
  getAllPayments,
} = require("../controllers/payment");

// Special handling for Stripe webhook
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook
);

// Protected routes (require authentication)
router.post("/create-payment-intent", protect, createPaymentIntent);
router.post("/confirm", protect, confirmPayment);
router.get("/:paymentIntentId", protect, getPaymentDetails);
router.post("/refund", protect, isAdmin("admin"), processRefund);
router.get("/", protect, isAdmin("admin"), getAllPayments);

module.exports = router;
