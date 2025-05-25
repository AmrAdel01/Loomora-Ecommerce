const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const User = require("../models/User");
const BlacklistedToken = require("../models/BlacklistedToken");

exports.protect = asyncHandler(async (req, res, next) => {
  // 1. Extract token from Authorization header
  let token;
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  // 2. Check if token exists
  if (!token) {
    return next(new ApiError("No token provided", 401));
  }

  try {
    // 3. Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4. Check if token is blacklisted
    const blacklisted = await BlacklistedToken.findOne({ token });
    if (blacklisted) {
      return next(new ApiError("Token is invalid or has been logged out", 401));
    }

    // 5. Find user and attach to request
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return next(new ApiError("User not found", 401));
    }

    if (user.role === "banned") {
      return next(new ApiError("Your account has been banned", 403));
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(new ApiError("Token has expired", 401));
    } else if (error.name === "JsonWebTokenError") {
      return next(new ApiError("Invalid token", 401));
    }
    return next(new ApiError("Authentication failed", 401));
  }
});

exports.isAdmin = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError("You are not authorized to access this resource", 403)
      );
    }
    next();
  };
};
