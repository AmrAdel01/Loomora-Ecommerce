const express = require("express");
const router = express.Router();
const { protect, isAdmin } = require("../middleware/authMiddleware");
const {
  createOrder,
  getOrders,
  updateOrderStatus,
} = require("../controllers/order");

// Protected routes
router.use(protect);

router.route("/").post(createOrder).get(isAdmin("admin"), getOrders);

router.patch("/:id/status", isAdmin("admin"), updateOrderStatus);

module.exports = router;
