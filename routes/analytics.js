const express = require("express");
const router = express.Router();
const { protect, isAdmin } = require("../middleware/authMiddleware");
const { getPaymentAnalytics } = require("../controllers/analytics");

router.get("/payments", protect, isAdmin("admin"), getPaymentAnalytics);

module.exports = router;
