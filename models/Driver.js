const mongoose = require("mongoose");

const driverSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Driver must be associated with a user account"],
    },
    licenseNumber: {
      type: String,
      required: [true, "License number is required"],
      unique: true,
      trim: true,
    },
    licenseExpiry: {
      type: Date,
      required: [true, "License expiry date is required"],
      validate: {
        validator: function (date) {
          return date > Date.now();
        },
        message: "License must be valid (future expiry date)",
      },
    },
    vehicle: {
      type: {
        make: { type: String, required: true },
        model: { type: String, required: true },
        year: { type: Number, required: true },
        color: { type: String, required: true },
        licensePlate: { type: String, required: true, unique: true },
      },
      required: [true, "Vehicle information is required"],
    },
    status: {
      type: String,
      enum: ["available", "on-delivery", "offline", "suspended"],
      default: "offline",
    },
    currentLocation: {
      type: {
        type: String,
        default: "Point",
        enum: ["Point"],
      },
      coordinates: [Number], // [longitude, latitude]
      address: String,
      lastUpdated: Date,
    },
    rating: {
      type: Number,
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating must not exceed 5"],
      default: 5,
    },
    deliveryStats: {
      totalDeliveries: { type: Number, default: 0 },
      successfulDeliveries: { type: Number, default: 0 },
      averageDeliveryTime: { type: Number, default: 0 }, // in minutes
    },
    documents: [
      {
        type: {
          type: String,
          enum: ["insurance", "registration", "inspection"],
        },
        url: String,
        expiryDate: Date,
        verified: { type: Boolean, default: false },
      },
    ],
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add geospatial index for driver location queries
driverSchema.index({ currentLocation: "2dsphere" });

// Virtual populate deliveries
driverSchema.virtual("deliveries", {
  ref: "Delivery",
  foreignField: "driver",
  localField: "_id",
});

const Driver = mongoose.model("Driver", driverSchema);
module.exports = Driver;
