const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  addToCart,
  updateCart,
  removeFromCart,
  clearCart,
  applyCoupon,
  removeCoupon,
  getCart,
} = require("../controllers/cart");

// All routes are protected and require authentication
router.use(protect);

// Get current user's cart
router.get("/", getCart);

// Add item to cart
router.post("/add/:id", addToCart);

// Update cart item
router.put("/update/:id", updateCart);

// Remove item from cart
router.delete("/remove/:productId/:size/:color", removeFromCart);

// Clear entire cart
router.delete("/clear", clearCart);

// Coupon routes
router.post("/coupon", applyCoupon);
router.delete("/coupon", removeCoupon);

module.exports = router;
