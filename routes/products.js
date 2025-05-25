const express = require("express");
const router = express.Router();
const {
  createProduct,
  updateProduct,
  getAllProducts,
  exportProductsCSV,
  getProductById,
  addCommentToProduct,
  deleteComment,
  toggleProductStatus,
  getRelatedProducts,
} = require("../controllers/product");
const { protect, isAdmin } = require("../middleware/authMiddleware");

router.route("/newproduct").post(protect, isAdmin("admin"), createProduct);
router.route("/export-csv").get(protect, isAdmin("admin"), exportProductsCSV);

router.route("/").get(protect, isAdmin("admin"), getAllProducts);
router.route("/:id").get(protect, isAdmin("admin"), getProductById);

router.route("/update/:id").put(protect, isAdmin("admin"), updateProduct);

router
  .route("/:id/comments")
  .post(protect, addCommentToProduct)
  .delete(protect, deleteComment);

router
  .route("/:id/toggle-status")
  .patch(protect, isAdmin("admin"), toggleProductStatus);

router.route("/:id/related").get(getRelatedProducts);

module.exports = router;
