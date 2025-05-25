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
    min: 0,
  },
  subTotal: {
    type: Number,
    required: true,
    min: 0,
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
    min: 0,
  },
  totalItems: {
    type: Number,
    default: 0,
    min: 0,
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
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
});

cartSchema.methods.calculateTotals = function () {
  // Calculate totalAmount with validation
  this.totalAmount = this.items.reduce((sum, item) => {
    const subTotal = Number(item.subTotal) || 0;
    if (Number.isNaN(subTotal)) {
      console.error(`Invalid subTotal for item: ${JSON.stringify(item)}`);
      return sum;
    }
    return sum + subTotal;
  }, 0);

  // Calculate totalItems
  this.totalItems = this.items.reduce((sum, item) => {
    const quantity = Number(item.quantity) || 0;
    return sum + quantity;
  }, 0);

  // Apply coupon discount if valid
  if (this.appliedCoupon && Number.isFinite(this.appliedCoupon.discount)) {
    this.totalAmount = Math.max(
      0,
      this.totalAmount - this.appliedCoupon.discount
    );
  }

  // Ensure totalAmount is not NaN
  if (Number.isNaN(this.totalAmount)) {
    console.error("totalAmount is NaN, resetting to 0");
    this.totalAmount = 0;
  }

  this.lastUpdated = Date.now();
};

module.exports = mongoose.model("Cart", cartSchema);
