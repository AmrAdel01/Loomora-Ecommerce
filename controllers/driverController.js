const Driver = require("../models/Driver");
const User = require("../models/User");
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");

// @desc    Register new driver
// @route   POST /api/drivers
// @access  Private/Admin
exports.registerDriver = asyncHandler(async (req, res, next) => {
  const { user: userId, licenseNumber, licenseExpiry, vehicle } = req.body;

  // 1) Verify user exists and is eligible to be a driver
  const user = await User.findById(userId);
  if (!user) {
    return next(new ApiError(404, "User not found"));
  }
  if (user.role !== "driver") {
    return next(new ApiError(400, "User role must be set to driver first"));
  }

  // 2) Create driver profile
  const driver = await Driver.create({
    user: userId,
    licenseNumber,
    licenseExpiry,
    vehicle,
    status: "offline",
  });

  res.status(201).json({
    status: "success",
    data: driver,
  });
});

// @desc    Get all drivers
// @route   GET /api/drivers
// @access  Private/Admin
exports.getDrivers = asyncHandler(async (req, res) => {
  // 1) Filtering
  const queryObj = { ...req.query };
  const excludedFields = ["page", "limit", "sort", "fields"];
  excludedFields.forEach((el) => delete queryObj[el]);

  // 2) Advanced filtering
  let queryStr = JSON.stringify(queryObj);
  queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

  let query = Driver.find(JSON.parse(queryStr)).populate(
    "user",
    "firstName lastName email phone"
  );

  // 3) Sorting
  if (req.query.sort) {
    const sortBy = req.query.sort.split(",").join(" ");
    query = query.sort(sortBy);
  } else {
    query = query.sort("-createdAt");
  }

  // 4) Pagination
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 10;
  const skip = (page - 1) * limit;
  const total = await Driver.countDocuments();

  query = query.skip(skip).limit(limit);

  const drivers = await query;

  res.status(200).json({
    status: "success",
    results: drivers.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: drivers,
  });
});

// @desc    Update driver location
// @route   PATCH /api/drivers/:id/location
// @access  Private/Driver
exports.updateDriverLocation = asyncHandler(async (req, res, next) => {
  const { coordinates, address } = req.body;

  if (!coordinates || coordinates.length !== 2) {
    return next(
      new ApiError(400, "Please provide valid coordinates [lng, lat]")
    );
  }

  const driver = await Driver.findByIdAndUpdate(
    req.params.id,
    {
      currentLocation: {
        type: "Point",
        coordinates,
        address,
        lastUpdated: Date.now(),
      },
    },
    { new: true }
  );

  if (!driver) {
    return next(new ApiError(404, "Driver not found"));
  }

  res.status(200).json({
    status: "success",
    data: {
      driverId: driver._id,
      location: driver.currentLocation,
    },
  });
});

// @desc    Update driver status
// @route   PATCH /api/drivers/:id/status
// @access  Private/Driver
exports.updateDriverStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;
  const allowedStatuses = ["available", "on-delivery", "offline"];

  if (!allowedStatuses.includes(status)) {
    return next(new ApiError(400, "Invalid status value"));
  }

  const driver = await Driver.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  );

  res.status(200).json({
    status: "success",
    data: {
      driverId: driver._id,
      newStatus: driver.status,
    },
  });
});

// @desc    Get available drivers near location
// @route   GET /api/drivers/available
// @access  Private
exports.getAvailableDrivers = asyncHandler(async (req, res) => {
  const { lng, lat, maxDistance = 10000 } = req.query; // Default 10km radius

  if (!lng || !lat) {
    return next(new ApiError(400, "Please provide longitude and latitude"));
  }

  const drivers = await Driver.find({
    status: "available",
    currentLocation: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [parseFloat(lng), parseFloat(lat)],
        },
        $maxDistance: parseInt(maxDistance),
      },
    },
  }).populate("user", "firstName lastName phone");

  res.status(200).json({
    status: "success",
    results: drivers.length,
    data: drivers,
  });
});

// @desc    Upload driver documents
// @route   POST /api/drivers/:id/documents
// @access  Private/Driver
exports.uploadDriverDocuments = asyncHandler(async (req, res, next) => {
  if (!req.files) {
    return next(new ApiError(400, "No files uploaded"));
  }

  const documents = req.files.map((file) => ({
    type: file.fieldname, // Expect fields: insurance, registration, inspection
    url: file.path,
    expiryDate: req.body[`${file.fieldname}Expiry`] || undefined,
  }));

  const driver = await Driver.findByIdAndUpdate(
    req.params.id,
    { $push: { documents: { $each: documents } } },
    { new: true }
  );

  res.status(200).json({
    status: "success",
    data: driver.documents,
  });
});
