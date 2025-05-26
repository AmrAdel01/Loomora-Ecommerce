const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
        min: 1,
      },
      size: String,
      color: String,
      price: Number,
    },
  ],
  totalAmount: {
    type: Number,
    required: true,
  },
  shippingAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
  },
  status: {
    type: String,
    enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
    default: "pending",
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "completed", "failed", "refunded", "partially_refunded"],
    default: "pending",
  },
  paymentMethod: {
    type: String,
    required: true,
  },
  stripePaymentIntentId: String,
  paymentAttempts: [
    {
      attemptedAt: Date,
      status: String,
      errorMessage: String,
    },
  ],
  refundId: String,
  refundAmount: Number,
  refundReason: String,
  trackingNumber: String,
  estimatedDeliveryDate: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: Date,
  deliveryInstructions: String,
  couponCode: String,
  discountAmount: Number,
  taxAmount: Number,
  shippingCost: Number,
});

// Virtual for total items count
orderSchema.virtual("itemCount").get(function () {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Method to calculate order summary
orderSchema.methods.getOrderSummary = function () {
  const subtotal = this.totalAmount;
  const discount = this.discountAmount || 0;
  const tax = this.taxAmount || 0;
  const shipping = this.shippingCost || 0;

  return {
    subtotal,
    discount,
    tax,
    shipping,
    total: subtotal - discount + tax + shipping,
  };
};

module.exports = mongoose.model("Order", orderSchema);
