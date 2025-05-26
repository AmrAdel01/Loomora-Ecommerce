const User = require("../models/User");
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const sendEmail = require("../utils/sendEmail");
const BlacklistedToken = require("../models/functions/BlacklistedToken");
const AuditLog = require("../models/functions/AuditLog");

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
};

// Auth
exports.signup = asyncHandler(async (req, res, next) => {
  const {
    firstName,
    lastName,
    email,
    password,
    dateOfBirth,
    phone,
    address,
    role,
  } = req.body;

  // Validate input
  if (
    !firstName ||
    !lastName ||
    !email ||
    !password ||
    !dateOfBirth ||
    !phone ||
    !address ||
    !role
  ) {
    return next(new ApiError(400, "All fields are required"));
  }

  // Check if user exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new ApiError(400, "User already exists"));
  }
  // Create user
  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    dateOfBirth,
    phone,
    address,
    role,
  });

  const result = user.toObject();
  delete result.password;
  const token = generateToken(user._id);
  const message =
    user.role.toLowerCase() === "admin"
      ? "Admin signup successfully"
      : "User created successfully";
  return res.status(201).json({
    status: "success",
    message,
    user: result,
    token,
  });
});

exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new ApiError(400, "All fields are required"));
  }
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+password"
  );
  if (!user) {
    return next(new ApiError(400, "User not found"));
  }
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return next(new ApiError(400, "Invalid password"));
  }
  const result = user.toObject();
  delete result.password;
  const token = generateToken(user._id);
  const message =
    user.role.toLowerCase() === "admin"
      ? "Admin login successfully"
      : "User login successfully";
  return res.status(200).json({
    status: "success",
    message,
    user: result,
    token,
  });
});

exports.logout = asyncHandler(async (req, res, next) => {
  const user = req.user;
  if (!user) {
    return next(new ApiError(401, "User not found"));
  }

  // 2. Get token from request (for blacklisting)
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return next(new ApiError(400, "No token provided"));
  }

  // 3. Check if multi-device logout is requested with default value
  const { logoutAllDevices = false } = req.body || {}; // Default to false if req.body is undefined

  if (logoutAllDevices) {
    // Invalidate all tokens for the user
    await BlacklistedToken.deleteMany({ user: user._id });
  }

  // 4. Add current token to blacklist
  const decodedToken = jwt.decode(token); // Decode without verification (just to get exp)
  await BlacklistedToken.create({
    token,
    user: user._id,
    expiresAt: new Date(decodedToken.exp * 1000),
  });

  // 5. Clear cookie with secure options
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });

  // 6. Log the logout action
  await AuditLog.create({
    action: logoutAllDevices ? "logout_all_devices" : "logout",
    user: user._id,
    metadata: {
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      timestamp: new Date(),
      logoutAllDevices: !!logoutAllDevices,
    },
  });

  return res.status(200).json({
    status: "success",
    message: logoutAllDevices
      ? "User logged out from all devices successfully"
      : "User logged out successfully",
    data: {
      userId: user._id,
      logoutAt: new Date().toISOString(),
      allDevices: !!logoutAllDevices,
    },
  });
});

exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return next(new ApiError(400, "User not found"));

  const resetToken = crypto.randomBytes(20).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  await user.save();

  const resetURL = `http://localhost:3000/api/v1/auth/reset-password/${resetToken}`;
  const message = `
      <h3>Password Reset Request</h3>
      <p>Please click the link below to reset your password:</p>
      <a href="${resetURL}">${resetURL}</a>
      <p>This link will expire in 10 minutes.</p>
    `;

  try {
    await sendEmail({
      email: user.email,
      subject: "Your Password Reset Link",
      message,
    });

    res.status(200).json({
      status: "success",
      message: "Reset email sent to user",
    });
  } catch (err) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    return next(new ApiError(500, "Email could not be sent"));
  }
});

exports.resetPassword = asyncHandler(async (req, res, next) => {
  const { token, newPassword } = req.body;

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) return next(new ApiError(400, "Token invalid or expired"));

  user.password = await bcrypt.hash(newPassword, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  return res.status(200).json({
    status: "success",
    message: "Password reset successfully",
  });
});

// Admin routes

exports.getUsers = asyncHandler(async (req, res, next) => {
  const { page, limit, sort, role, fields } = req.query;

  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const skip = (pageNum - 1) * limitNum;

  let filter = role ? { role } : {};
  filter = {
    ...filter,
    _id: { $ne: req.user._id }, // Exclude the current admin
  };

  const users = await User.find(filter)
    .sort(sort || "-createdAt")
    .select(fields || "-password")
    .skip(skip)
    .limit(limitNum);
  const totalUsers = await User.countDocuments(filter);
  const totalPages = Math.ceil(totalUsers / limitNum);
  return res.status(200).json({
    status: "success",
    message: "Users fetched successfully",
    users,
    total: users.length,
    page: pageNum,
    totalPages,
    limit: limitNum,
  });
});

exports.userId = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user) {
    return next(new ApiError(400, "User not found"));
  }
  const userObj = user.toObject();
  delete userObj.password;
  return res.status(200).json({
    status: "success",
    message: "User found",
    user: userObj,
  });
});

exports.deleteUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user) {
    return next(new ApiError(400, "User not found"));
  }
  await user.deleteOne();
  return res.status(200).json({
    status: "success",
    message: "User deleted successfully",
  });
});

exports.adminUpdateUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  // 1. Validate ID format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError(400, "Invalid user ID format"));
  }

  // 2. Prevent sensitive fields from being updated
  const restrictedUpdates = ["password", "role", "verified", "loyaltyPoints"];
  restrictedUpdates.forEach((field) => {
    if (req.body[field]) {
      return next(
        new ApiError(400, `Cannot update ${field} through this endpoint`)
      );
    }
  });

  // 3. Handle email uniqueness if email is being updated
  if (req.body.email) {
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser && existingUser._id.toString() !== id) {
      return next(new ApiError(400, "Email already in use"));
    }
  }

  // 4. Update user
  const updatedUser = await User.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!updatedUser) {
    return next(new ApiError(404, "User not found"));
  }

  // 5. Remove sensitive data from response
  const userObj = updatedUser.toObject();
  delete userObj.password;
  delete userObj.resetPasswordToken;
  delete userObj.resetPasswordExpire;

  res.status(200).json({
    status: "success",
    message: "User updated successfully",
    data: userObj,
  });
});

// User profile
exports.getCurrentUser = asyncHandler(async (req, res, next) => {
  // Populate additional relationships that are useful for the frontend
  const user = await User.findById(req.user._id)
    .select("-password -resetPasswordToken -resetPasswordExpire")
    .populate({
      path: "wishlist",
      select: "name price images discountPrice",
    })
    .populate({
      path: "addresses",
      select: "street city state zipCode country isDefault",
    })
    .populate({
      path: "recentOrders",
      select: "orderNumber totalAmount status createdAt",
      options: { sort: { createdAt: -1 }, limit: 3 },
    });

  if (!user) {
    return next(new ApiError(404, "User not found"));
  }

  // Calculate loyalty tier based on order history
  const orderStats = await Order.aggregate([
    { $match: { user: req.user._id, status: "delivered" } },
    {
      $group: {
        _id: null,
        totalSpent: { $sum: "$totalAmount" },
        orderCount: { $sum: 1 },
      },
    },
  ]);

  const loyaltyData = {
    tier: "Bronze",
    points: 0,
    nextTier: "Silver",
    progress: 0,
    totalSpent: 0,
    orderCount: 0,
  };

  if (orderStats.length > 0) {
    const { totalSpent, orderCount } = orderStats[0];
    loyaltyData.totalSpent = totalSpent;
    loyaltyData.orderCount = orderCount;

    // Calculate loyalty tier (example logic)
    if (totalSpent > 1000) {
      loyaltyData.tier = "Gold";
      loyaltyData.nextTier = "Platinum";
      loyaltyData.progress = Math.min(100, ((totalSpent - 1000) / 500) * 100);
    } else if (totalSpent > 500) {
      loyaltyData.tier = "Silver";
      loyaltyData.nextTier = "Gold";
      loyaltyData.progress = Math.min(100, ((totalSpent - 500) / 500) * 100);
    } else {
      loyaltyData.progress = Math.min(100, (totalSpent / 500) * 100);
    }

    loyaltyData.points = Math.floor(totalSpent / 10); // 1 point per $10 spent
  }

  // Prepare notification data
  const unreadNotifications = await Notification.countDocuments({
    user: req.user._id,
    read: false,
  });

  res.status(200).json({
    status: "success",
    data: {
      user,
      loyalty: loyaltyData,
      notifications: {
        unreadCount: unreadNotifications,
        recent: [], // Could populate with actual recent notifications
      },
      preferences: {
        newsletter: user.newsletterSubscription || false,
        smsAlerts: user.smsAlerts || false,
      },
    },
  });
});

exports.updateMyProfile = asyncHandler(async (req, res, next) => {
  // 1. Define allowed fields and filter request body
  const allowedFields = [
    "firstName",
    "lastName",
    "email",
    "phone",
    "address",
    "avatar",
  ];
  const filteredBody = _.pick(req.body, allowedFields);

  // 2. Special handling for email updates
  if (filteredBody.email) {
    const existingUser = await User.findOne({ email: filteredBody.email });
    if (
      existingUser &&
      existingUser._id.toString() !== req.user._id.toString()
    ) {
      return next(new ApiError(400, "Email is already in use"));
    }

    // Add email verification flow if needed
    filteredBody.emailVerified = false;
    // You might want to send a verification email here
  }

  // 3. Handle address updates (partial updates)
  if (filteredBody.address) {
    const currentUser = await User.findById(req.user._id);
    filteredBody.address = { ...currentUser.address, ...filteredBody.address };
  }

  // 4. Handle avatar upload (if included)
  if (req.file) {
    filteredBody.avatar = {
      url: req.file.path,
      publicId: req.file.filename,
      uploadedAt: Date.now(),
    };
    // You might want to delete the old avatar from storage
  }

  // 5. Update user with transaction for data consistency
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      filteredBody,
      {
        new: true,
        runValidators: true,
        session,
      }
    ).select("-password -resetPasswordToken -resetPasswordExpire");

    // 6. Log the profile update
    await AuditLog.create(
      [
        {
          action: "profile_update",
          user: req.user._id,
          metadata: {
            updatedFields: Object.keys(filteredBody),
            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
          },
          timestamp: new Date(),
        },
      ],
      { session }
    );

    await session.commitTransaction();

    // 7. Publish event for potential downstream services
    eventEmitter.emit("userProfileUpdated", {
      userId: req.user._id,
      updatedFields: Object.keys(filteredBody),
    });

    res.status(200).json({
      status: "success",
      data: updatedUser,
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

exports.changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user) {
    return next(new ApiError(400, "User not found"));
  }

  const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isPasswordValid) {
    return next(new ApiError(400, "Invalid current password"));
  }

  if (newPassword !== confirmPassword) {
    return next(
      new ApiError(400, "New password and confirmation do not match")
    );
  }

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  return res.status(200).json({
    status: "success",
    message: "Password changed successfully",
  });
});
