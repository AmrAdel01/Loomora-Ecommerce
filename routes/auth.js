const express = require("express");
const {
  signup,
  login,
  logout,
  forgotPassword,
  resetPassword,
  userId,
  getUsers,
  changePassword,
  deleteUser,
  adminUpdateUser,
  getCurrentUser,
  updateMyProfile,
} = require("../controllers/auth");
const {
  signupValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  changePasswordValidator,
  userIdValidator,
  getUsersValidator,
  deleteUserValidator,
  updateUserValidator,
} = require("../utils/validations/userValidators");

const { protect, isAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

// Auth routes
router.route("/signup").post(signupValidator, signup);
router.route("/login").post(loginValidator, login);
router.route("/logout").post(protect, logout);

router.route("/forgot-password").post(forgotPasswordValidator, forgotPassword);
router.route("/reset-password").post(resetPasswordValidator, resetPassword);

// Admin-only routes
router
  .route("/admin/users")
  .get(protect, getUsersValidator, isAdmin("admin"), getUsers);
router
  .route("/admin/user/:id")
  .get(protect, userIdValidator, isAdmin("admin"), userId)
  .delete(protect, deleteUserValidator, isAdmin("admin"), deleteUser);
router
  .route("/admin/users/:id")
  .put(protect, updateUserValidator, isAdmin("admin"), adminUpdateUser);

// User profile routes (protected)
router.get("/me", protect, getCurrentUser);
router.put("/me", protect, updateUserValidator, updateMyProfile);
router
  .route("/me/change-password/:id")
  .post(changePasswordValidator, changePassword);
module.exports = router;
