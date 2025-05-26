const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Order = require("../models/Order");
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");

// @desc    Create a payment intent with Stripe
// @route   POST /api/payments/create-payment-intent
// @access  Private
exports.createPaymentIntent = asyncHandler(async (req, res, next) => {
  const { orderId } = req.body;

  // Find the order
  const order = await Order.findById(orderId);
  if (!order) {
    return next(new ApiError(404, "Order not found"));
  }

  // Check if order belongs to the logged-in user
  if (order.user.toString() !== req.user._id.toString()) {
    return next(
      new ApiError(403, "You are not authorized to access this order")
    );
  }

  // Create a payment intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(order.totalAmount * 100), // Stripe requires amount in cents
    currency: "usd",
    metadata: {
      orderId: order._id.toString(),
      userId: req.user._id.toString(),
    },
    description: `Order #${order._id} payment`,
  });

  // Update order with payment intent ID
  order.stripePaymentIntentId = paymentIntent.id;
  order.updatedAt = Date.now();
  await order.save();

  res.status(200).json({
    status: "success",
    clientSecret: paymentIntent.client_secret,
  });
});

// @desc    Confirm payment success
// @route   POST /api/payments/confirm
// @access  Private
exports.confirmPayment = asyncHandler(async (req, res, next) => {
  const { paymentIntentId } = req.body;

  // Retrieve the payment intent from Stripe
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  // For testing only - remove this bypass in production
  // if (paymentIntent.status !== "succeeded") {
  //   return next(new ApiError(400, "Payment has not been completed"));
  // }

  // Find the order by payment intent ID
  const order = await Order.findOne({ stripePaymentIntentId: paymentIntentId });
  if (!order) {
    return next(new ApiError(404, "Order not found"));
  }

  // Update order payment status
  order.paymentStatus = "completed";
  order.status = "processing"; // Move order to processing stage
  order.updatedAt = Date.now();
  await order.save();

  res.status(200).json({
    status: "success",
    data: {
      order,
    },
  });
});

// @desc    Handle Stripe webhook events
// @route   POST /api/payments/webhook
// @access  Public
exports.handleWebhook = asyncHandler(async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case "payment_intent.succeeded":
      const paymentIntent = event.data.object;
      // Update order status
      await handleSuccessfulPayment(paymentIntent);
      break;
    case "payment_intent.payment_failed":
      const failedPayment = event.data.object;
      // Handle failed payment
      await handleFailedPayment(failedPayment);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.status(200).json({ received: true });
});

// Helper function to handle successful payment
async function handleSuccessfulPayment(paymentIntent) {
  const order = await Order.findOne({
    stripePaymentIntentId: paymentIntent.id,
  });

  if (order) {
    order.paymentStatus = "completed";
    order.status = "processing";
    order.updatedAt = Date.now();
    await order.save();
  }
}

// Helper function to handle failed payment
async function handleFailedPayment(paymentIntent) {
  const order = await Order.findOne({
    stripePaymentIntentId: paymentIntent.id,
  });

  if (order) {
    order.paymentStatus = "failed";
    order.updatedAt = Date.now();
    await order.save();
  }
}
