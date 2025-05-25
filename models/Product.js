const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to a User model
      required: [true, "Comment must be associated with a user"],
    },
    text: {
      type: String,
      required: [true, "Comment text is required"],
      trim: true,
      minlength: [3, "Comment must be at least 3 characters long"],
      maxlength: [500, "Comment cannot exceed 500 characters"],
    },
    rating: {
      type: Number,
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true } // Ensure each comment has its own _id
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      minlength: [3, "Name must be at least 3 characters long"],
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
      trim: true,
      minlength: [10, "Description must be at least 10 characters long"],
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    brand: {
      type: String,
      required: [true, "Brand is required"],
      trim: true,
    },
    sizeOptions: [
      {
        type: String,
        enum: {
          values: ["XS", "S", "M", "L", "XL", "XXL", "XXXL"],
          message: "{VALUE} is not a valid size",
        },
      },
    ],
    colorOptions: [
      {
        type: String,
        enum: {
          values: [
            "red",
            "blue",
            "green",
            "black",
            "white",
            "yellow",
            "pink",
            "purple",
            "gray",
            "brown",
            "orange",
          ],
          message: "{VALUE} is not a valid color",
        },
      },
    ],
    material: {
      type: String,
      default: "",
      trim: true,
    },
    images: [
      {
        type: String,
        default: "",
      },
    ],
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    discountPrice: {
      type: Number,
      min: [0, "Discount price cannot be negative"],
      validate: {
        validator: function (value) {
          return value <= this.price;
        },
        message: "Discount price cannot exceed regular price",
      },
    },
    quantity: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, "Quantity is required"],
      validate: {
        validator: function (value) {
          // Handle number case
          if (typeof value === "number") {
            return value >= 0;
          }
          // Handle Map/object case
          if (value instanceof Map || typeof value === "object") {
            const quantities =
              value instanceof Map ? [...value.values()] : Object.values(value);
            return quantities.every((qty) => Number.isFinite(qty) && qty >= 0);
          }
          return false;
        },
        message:
          "Quantity must be a non-negative number or a Map/object of non-negative quantities",
      },
      default: 0,
    },
    sku: {
      type: String,
      unique: true,
      default: function () {
        return "PROD-" + Math.random().toString(36).slice(2, 11).toUpperCase();
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    comments: [commentSchema], // Embedded comments subdocument
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for checking if product is discounted
productSchema.virtual("isDiscounted").get(function () {
  return this.discountPrice && this.discountPrice < this.price;
});

// Virtual for total stock
productSchema.virtual("totalStock").get(function () {
  if (typeof this.quantity === "number") {
    return this.quantity;
  }
  if (this.quantity instanceof Map) {
    return [...this.quantity.values()].reduce((sum, qty) => sum + qty, 0);
  }
  return 0;
});

// Virtual for average rating
productSchema.virtual("averageRating").get(function () {
  if (!this.comments || this.comments.length === 0) return 0;
  const ratings = this.comments
    .filter((comment) => comment.rating)
    .map((comment) => comment.rating);
  return ratings.length
    ? (
        ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
      ).toFixed(1)
    : 0;
});

// Indexes
productSchema.index({ category: 1, brand: 1 });
productSchema.index({
  name: "text",
  description: "text",
  "comments.text": "text",
});
productSchema.index({ price: 1 });
productSchema.index({ isActive: 1 });
productSchema.index(
  {
    name: 1,
    category: 1,
    subcategory: 1,
    brand: 1,
    sizeOptions: 1,
    colorOptions: 1,
    material: 1,
  },
  { unique: true, sparse: true }
);

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
