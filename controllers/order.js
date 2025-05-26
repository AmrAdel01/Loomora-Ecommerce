const Order = require("../models/Order");
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const Coupon = require("../models/functions/Coupon");

// @desc    Create a new order
// @route   POST /api/orders
// @access  Private
exports.createOrder = asyncHandler(async (req, res, next) => {
  const {
    items,
    shippingAddress,
    paymentMethod,
    deliveryInstructions,
    couponCode,
  } = req.body;

  // Validate payment method
  const validPaymentMethods = ["stripe", "paypal", "cash_on_delivery"];
  if (!validPaymentMethods.includes(paymentMethod)) {
    return next(new ApiError(400, "Invalid payment method"));
  }

  // Calculate total amount, discount, and tax
  const totalAmount = calculateTotalAmount(items);
  const discountAmount = await calculateDiscount(couponCode);
  const taxAmount = calculateTax(totalAmount);
  const shippingCost = calculateShipping(shippingAddress);

  const order = await Order.create({
    user: req.user._id,
    items,
    totalAmount,
    shippingAddress,
    paymentMethod,
    deliveryInstructions,
    couponCode,
    discountAmount,
    taxAmount,
    shippingCost,
  });

  res.status(201).json({
    status: "success",
    data: order,
  });
});

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
exports.getOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find().populate("user", "name email");

  res.status(200).json({
    status: "success",
    results: orders.length,
    data: orders,
  });
});

// @desc    Update order status
// @route   PATCH /api/orders/:id/status
// @access  Private/Admin
exports.updateOrderStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;

  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  );

  if (!order) {
    return next(new ApiError(404, "Order not found"));
  }

  res.status(200).json({
    status: "success",
    data: order,
  });
});

// Helper functions for calculations
const calculateTotalAmount = (items) => {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
};

const calculateDiscount = async (couponCode) => {
  const coupon = await Coupon.findOne({ code: couponCode });
  if (!coupon) {
    return 0; // No discount if coupon is not found
  }
  // Check if the coupon is still valid
  const currentDate = new Date();
  if (
    coupon.validUntil < currentDate ||
    coupon.maxUses <= coupon.usedBy.length
  ) {
    return 0; // No discount if coupon is expired or max uses reached
  }
  return coupon.discount / 100; // Return discount as a percentage
};

const calculateTax = (totalAmount) => {
  const taxRate = 0.07; // Example tax rate of 7%
  return totalAmount * taxRate;
};

const calculateShipping = (shippingAddress) => {
  // Example logic: Flat rate shipping cost
  return 5.99; // Flat rate
};
