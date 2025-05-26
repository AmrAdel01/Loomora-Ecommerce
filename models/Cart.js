const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
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
  price: {
    type: Number,
    required: true,
  },
  subTotal: {
    type: Number,
    required: true,
  },
});

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  items: [cartItemSchema],
  totalAmount: {
    type: Number,
    default: 0,
  },
  totalItems: {
    type: Number,
    default: 0,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ["active", "abandoned", "converted"],
    default: "active",
  },
  appliedCoupon: {
    code: String,
    discount: Number,
  },
});

cartSchema.methods.calculateTotals = function () {
  this.totalAmount = this.items.reduce((sum, item) => sum + item.subTotal, 0);
  this.totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
  if (this.appliedCoupon) {
    this.totalAmount -= this.appliedCoupon.discount;
  }
};

module.exports = mongoose.model("Cart", cartSchema);
