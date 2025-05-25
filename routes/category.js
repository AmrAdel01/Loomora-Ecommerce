const express = require("express");
const router = express.Router();
const { protect, isAdmin } = require("../middleware/authMiddleware");
const {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} = require("../controllers/category");

// Public routes
router.get("/", getCategories);
router.get("/:id", getCategoryById);

// Protected routes (admin only)
router.route("/").post(protect, isAdmin("admin"), createCategory);

router
  .route("/:id")
  .put(protect, isAdmin("admin"), updateCategory)
  .delete(protect, isAdmin("admin"), deleteCategory);

module.exports = router;
