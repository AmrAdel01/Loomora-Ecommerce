const Order = require("../models/Order");
const asyncHandler = require("express-async-handler");

// @desc    Get payment analytics
// @route   GET /api/analytics/payments
// @access  Private/Admin
exports.getPaymentAnalytics = asyncHandler(async (req, res) => {
  // Get date range from query params or default to last 30 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (parseInt(req.query.days) || 30));

  // Get payment method distribution
  const paymentMethodStats = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        paymentStatus: { $in: ["completed", "refunded", "partially_refunded"] },
      },
    },
    {
      $group: {
        _id: "$paymentMethod",
        count: { $sum: 1 },
        total: { $sum: "$totalAmount" },
      },
    },
  ]);

  // Get daily payment totals
  const dailyPayments = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        paymentStatus: "completed",
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        total: { $sum: "$totalAmount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Get payment status distribution
  const paymentStatusStats = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: "$paymentStatus",
        count: { $sum: 1 },
      },
    },
  ]);

  res.status(200).json({
    status: "success",
    data: {
      paymentMethodStats,
      dailyPayments,
      paymentStatusStats,
    },
  });
});
