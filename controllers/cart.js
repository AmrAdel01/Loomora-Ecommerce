const Cart = require("../models/Cart");
const Product = require("../models/Product");
const Coupon = require("../models/Coupon");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("express-async-handler");

// Helper function to generate random coupon code
const generateRandomCode = (minLength, maxLength) => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const length =
    Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
  let code = "";
  for (let i = 0; i < length; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
};

// Generate a random coupon (admin-only endpoint)
exports.generateCoupon = asyncHandler(async (req, res, next) => {
  const { validDays = 30, maxUses = Infinity, minPurchase = 0 } = req.body;

  let code = generateRandomCode(5, 10);
  let existingCoupon = await Coupon.findOne({ code });
  while (existingCoupon) {
    code = generateRandomCode(5, 10);
    existingCoupon = await Coupon.findOne({ code });
  }

  const discount = Math.floor(Math.random() * (50 - 5 + 1)) + 5;
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + validDays);

  const coupon = await Coupon.create({
    code,
    discount,
    validUntil,
    maxUses,
    minPurchase,
    usedBy: [],
  });

  res.status(201).json({
    success: true,
    message: "Coupon generated successfully",
    data: coupon,
  });
});

exports.addToCart = asyncHandler(async (req, res, next) => {
  const productId = req.params.id;
  const { quantity, size, color } = req.body;
  const userId = req.user._id;

  // Validate quantity
  if (!Number.isInteger(quantity) || quantity < 1) {
    return next(new ApiError(400, "Quantity must be a positive integer"));
  }

  const product = await Product.findById(productId);
  if (!product) return next(new ApiError(404, "Product not found"));

  // Validate product price
  if (typeof product.price !== "number" || product.price <= 0) {
    return next(new ApiError(400, "Invalid product price"));
  }

  // Validate size and color
  if (size && !product.sizeOptions.includes(size)) {
    return next(new ApiError(400, `Invalid size: ${size}`));
  }
  if (color && !product.colorOptions.includes(color)) {
    return next(new ApiError(400, `Invalid color: ${color}`));
  }

  // Validate and update stock
  if (product.quantity instanceof Map || typeof product.quantity === "object") {
    const variantKey = `${size}-${color}`;
    const availableStock =
      product.quantity instanceof Map
        ? product.quantity.get(variantKey) || 0
        : product.quantity[variantKey] || 0;
    if (availableStock < quantity) {
      return next(
        new ApiError(
          400,
          `Insufficient stock for ${size} ${color}: ${availableStock} available`
        )
      );
    }
    // Update stock
    product.quantity instanceof Map
      ? product.quantity.set(variantKey, availableStock - quantity)
      : (product.quantity[variantKey] = availableStock - quantity);
    await product.save();
  } else if (typeof product.quantity === "number") {
    if (product.quantity < quantity) {
      return next(
        new ApiError(400, `Insufficient stock: ${product.quantity} available`)
      );
    }
    product.quantity -= quantity;
    await product.save();
  }

  let cart = await Cart.findOne({ user: userId, status: "active" });
  if (!cart) {
    cart = await Cart.create({ user: userId });
  }

  const itemIndex = cart.items.findIndex(
    (item) =>
      item.product.toString() === productId &&
      item.size === size &&
      item.color === color
  );

  if (itemIndex > -1) {
    cart.items[itemIndex].quantity += quantity;
    cart.items[itemIndex].subTotal =
      cart.items[itemIndex].quantity * product.price;
  } else {
    cart.items.push({
      product: productId,
      quantity,
      size,
      color,
      price: product.price,
      subTotal: quantity * product.price,
    });
  }

  console.log("Cart items before calculateTotals:", cart.items);

  await cart.calculateTotals();
  await cart.save();

  res.status(200).json({
    success: true,
    data: cart,
  });
});

exports.updateCart = asyncHandler(async (req, res, next) => {
  const productId = req.params.id;
  const { quantity, size, color } = req.body;
  const userId = req.user.id;

  const cart = await Cart.findOne({ user: userId, status: "active" });
  if (!cart) return next(new ApiError(404, "Cart not found"));

  const itemIndex = cart.items.findIndex(
    (item) =>
      item.product.toString() === productId &&
      item.size === size &&
      item.color === color
  );

  if (itemIndex === -1)
    return next(new ApiError(404, "Item not found in cart"));

  if (quantity <= 0) {
    const item = cart.items[itemIndex];
    // Restore stock when removing item
    const product = await Product.findById(productId);
    if (!product) return next(new ApiError(404, "Product not found"));
    if (
      product.quantity instanceof Map ||
      typeof product.quantity === "object"
    ) {
      const variantKey = `${item.size}-${item.color}`;
      const currentStock =
        product.quantity instanceof Map
          ? product.quantity.get(variantKey) || 0
          : product.quantity[variantKey] || 0;
      product.quantity instanceof Map
        ? product.quantity.set(variantKey, currentStock + item.quantity)
        : (product.quantity[variantKey] = currentStock + item.quantity);
      await product.save();
    } else if (typeof product.quantity === "number") {
      product.quantity += item.quantity;
      await product.save();
    }
    cart.items.splice(itemIndex, 1);
  } else {
    const product = await Product.findById(productId);
    if (!product) return next(new ApiError(404, "Product not found"));

    // Validate size and color
    if (size && !product.sizeOptions.includes(size)) {
      return next(new ApiError(400, `Invalid size: ${size}`));
    }
    if (color && !product.colorOptions.includes(color)) {
      return next(new ApiError(400, `Invalid color: ${color}`));
    }

    // Validate and update stock
    const oldQuantity = cart.items[itemIndex].quantity;
    const quantityDifference = quantity - oldQuantity;
    if (quantityDifference > 0) {
      // Check stock for additional quantity
      if (
        product.quantity instanceof Map ||
        typeof product.quantity === "object"
      ) {
        const variantKey = `${size}-${color}`;
        const availableStock =
          product.quantity instanceof Map
            ? product.quantity.get(variantKey) || 0
            : product.quantity[variantKey] || 0;
        if (availableStock < quantityDifference) {
          return next(
            new ApiError(
              400,
              `Insufficient stock for ${size} ${color}: ${availableStock} available`
            )
          );
        }
        product.quantity instanceof Map
          ? product.quantity.set(
              variantKey,
              availableStock - quantityDifference
            )
          : (product.quantity[variantKey] =
              availableStock - quantityDifference);
        await product.save();
      } else if (typeof product.quantity === "number") {
        if (product.quantity < quantityDifference) {
          return next(
            new ApiError(
              400,
              `Insufficient stock: ${product.quantity} available`
            )
          );
        }
        product.quantity -= quantityDifference;
        await product.save();
      }
    } else if (quantityDifference < 0) {
      // Restore stock for reduced quantity
      const product = await Product.findById(productId);
      if (
        product.quantity instanceof Map ||
        typeof product.quantity === "object"
      ) {
        const variantKey = `${size}-${color}`;
        const currentStock =
          product.quantity instanceof Map
            ? product.quantity.get(variantKey) || 0
            : product.quantity[variantKey] || 0;
        product.quantity instanceof Map
          ? product.quantity.set(variantKey, currentStock - quantityDifference)
          : (product.quantity[variantKey] = currentStock - quantityDifference);
        await product.save();
      } else if (typeof product.quantity === "number") {
        product.quantity -= quantityDifference; // quantityDifference is negative, so this adds back
        await product.save();
      }
    }

    cart.items[itemIndex].quantity = quantity;
    cart.items[itemIndex].subTotal = quantity * product.price;
  }

  await cart.calculateTotals();
  await cart.save();

  res.status(200).json({
    success: true,
    data: cart,
  });
});

exports.removeFromCart = asyncHandler(async (req, res, next) => {
  const { productId, size, color } = req.params;
  const userId = req.user._id;

  const cart = await Cart.findOne({ user: userId, status: "active" });
  if (!cart) return next(new ApiError(404, "Cart not found"));

  const itemIndex = cart.items.findIndex(
    (item) =>
      item.product.toString() === productId &&
      item.size === size &&
      item.color === color
  );

  if (itemIndex === -1)
    return next(new ApiError(404, "Item not found in cart"));

  const item = cart.items[itemIndex];
  // Restore stock when removing item
  const product = await Product.findById(productId);
  if (!product) return next(new ApiError(404, "Product not found"));
  if (product.quantity instanceof Map || typeof product.quantity === "object") {
    const variantKey = `${size}-${color}`;
    const currentStock =
      product.quantity instanceof Map
        ? product.quantity.get(variantKey) || 0
        : product.quantity[variantKey] || 0;
    product.quantity instanceof Map
      ? product.quantity.set(variantKey, currentStock + item.quantity)
      : (product.quantity[variantKey] = currentStock + item.quantity);
    await product.save();
  } else if (typeof product.quantity === "number") {
    product.quantity += item.quantity;
    await product.save();
  }

  cart.items.splice(itemIndex, 1);
  await cart.calculateTotals();
  await cart.save();

  res.status(200).json({
    success: true,
    data: cart,
  });
});

exports.clearCart = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  const cart = await Cart.findOne({ user: userId, status: "active" });
  if (!cart) return next(new ApiError(404, "Cart not found"));

  // Restore stock for all items in cart
  for (const item of cart.items) {
    const product = await Product.findById(item.product);
    if (product) {
      if (
        product.quantity instanceof Map ||
        typeof product.quantity === "object"
      ) {
        const variantKey = `${item.size}-${item.color}`;
        const currentStock =
          product.quantity instanceof Map
            ? product.quantity.get(variantKey) || 0
            : product.quantity[variantKey] || 0;
        product.quantity instanceof Map
          ? product.quantity.set(variantKey, currentStock + item.quantity)
          : (product.quantity[variantKey] = currentStock + item.quantity);
        await product.save();
      } else if (typeof product.quantity === "number") {
        product.quantity += item.quantity;
        await product.save();
      }
    }
  }

  cart.items = [];
  cart.totalAmount = 0;
  cart.totalItems = 0;
  cart.appliedCoupon = null;
  await cart.save();

  res.status(200).json({
    success: true,
    message: "Cart cleared successfully",
  });
});

exports.applyCoupon = asyncHandler(async (req, res, next) => {
  const { couponCode } = req.body;
  const userId = req.user._id;

  const cart = await Cart.findOne({ user: userId, status: "active" }).populate(
    "items.product"
  );
  if (!cart) return next(new ApiError(404, "Cart not found"));

  const coupon = await validateCoupon(couponCode, userId, cart.totalAmount);
  if (!coupon.isValid) {
    return next(new ApiError(400, coupon.message));
  }

  cart.appliedCoupon = {
    code: couponCode,
    discount: coupon.discount,
  };

  await cart.calculateTotals();
  await cart.save();

  res.status(200).json({
    success: true,
    data: cart,
  });
});

exports.removeCoupon = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  const cart = await Cart.findOne({ user: userId, status: "active" });
  if (!cart) return next(new ApiError(404, "Cart not found"));

  cart.appliedCoupon = null;
  await cart.calculateTotals();
  await cart.save();

  res.status(200).json({
    success: true,
    data: cart,
  });
});

exports.getCart = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  let cart = await Cart.findOne({ user: userId, status: "active" }).populate(
    "items.product",
    "name price images"
  );

  if (!cart) {
    cart = await Cart.create({ user: userId });
  }

  if (!cart.items || cart.items.length === 0) {
    return res.status(200).json({
      success: true,
      message: "There are no items in your cart",
      data: cart,
    });
  }

  res.status(200).json({
    success: true,
    data: cart,
  });
});

async function validateCoupon(code, userId, cartTotal) {
  const coupon = await Coupon.findOne({ code: code.toUpperCase() });
  if (!coupon) {
    return {
      isValid: false,
      message: "Coupon not found",
    };
  }

  if (coupon.validUntil < Date.now()) {
    return {
      isValid: false,
      message: "Coupon has expired",
    };
  }

  if (coupon.usedBy.includes(userId)) {
    return {
      isValid: false,
      message: "Coupon already used by this user",
    };
  }

  if (coupon.maxUses <= coupon.usedBy.length) {
    return {
      isValid: false,
      message: "Coupon usage limit reached",
    };
  }

  if (cartTotal < coupon.minPurchase) {
    return {
      isValid: false,
      message: `Minimum purchase of ${coupon.minPurchase} required`,
    };
  }

  return {
    isValid: true,
    discount: coupon.discount,
    message: "Coupon applied successfully",
  };
}
