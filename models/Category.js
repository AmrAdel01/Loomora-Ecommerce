const mongoose = require("mongoose");
const slugify = require("slugify");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
    },
    description: String,
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    ancestors: [
      {
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Category",
        },
        name: String,
        slug: String,
      },
    ],
    level: {
      type: Number,
      default: 0,
    },
    image: {
      url: String,
      alt: String,
    },
    icon: String,
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    seo: {
      metaTitle: String,
      metaDescription: String,
      keywords: [String],
    },
    attributes: [
      {
        name: String,
        values: [String],
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

categorySchema.pre("save", function (next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

// Prevent deletion if category is referenced by products
categorySchema.pre("remove", async function (next) {
  const products = await mongoose.model("Product").countDocuments({
    $or: [{ category: this._id }, { subcategory: this._id }],
  });
  if (products > 0) {
    return next(
      new Error("Cannot delete category because it is referenced by products")
    );
  }
  next();
});

categorySchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  if (update.name) {
    update.slug = slugify(update.name, { lower: true });
  }
  next();
});

categorySchema.virtual("subcategories", {
  ref: "Category",
  localField: "_id",
  foreignField: "parent",
});

module.exports = mongoose.model("Category", categorySchema);
