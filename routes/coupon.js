const express = require("express");
const router = express.Router();
const { protect, isAdmin } = require("../middleware/authMiddleware");
const { generateCoupon } = require("../controllers/cart");

router.post("/coupons", protect, isAdmin("admin"), generateCoupon);

module.exports = router;
