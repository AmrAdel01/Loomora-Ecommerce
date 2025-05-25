const Category = require("../models/Category");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("express-async-handler");

exports.createCategory = asyncHandler(async (req, res) => {
  const { name, description, parent, image, icon, attributes } = req.body;

  let level = 0;
  let ancestors = [];

  if (parent) {
    const parentCategory = await Category.findById(parent);
    if (!parentCategory) throw new ApiError(404, "Parent category not found");

    level = parentCategory.level + 1;
    ancestors = [
      ...parentCategory.ancestors,
      {
        _id: parentCategory._id,
        name: parentCategory.name,
        slug: parentCategory.slug,
      },
    ];
  }

  const category = await Category.create({
    name,
    description,
    parent,
    ancestors,
    level,
    image,
    icon,
    attributes,
  });

  res.status(201).json({
    success: true,
    data: category,
  });
});

exports.getCategories = asyncHandler(async (req, res) => {
  const { level, parent, includeInactive } = req.query;
  const query = {};

  if (level !== undefined) query.level = level;
  if (parent) query.parent = parent;
  if (!includeInactive) query.isActive = true;

  const categories = await Category.find(query)
    .populate("parent", "name slug")
    .populate("subcategories", "name slug image")
    .sort("sortOrder name");

  res.json({
    success: true,
    count: categories.length,
    data: categories,
  });
});

exports.getCategoryById = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id)
    .populate("parent", "name slug")
    .populate("subcategories", "name slug image");

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  res.json({
    success: true,
    data: category,
  });
});

exports.updateCategory = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    parent,
    image,
    icon,
    attributes,
    isActive,
    sortOrder,
    seo,
  } = req.body;
  const categoryId = req.params.id;

  const category = await Category.findById(categoryId);
  if (!category) throw new ApiError(404, "Category not found");

  // Prevent circular references
  if (parent && parent.toString() === categoryId) {
    throw new ApiError(400, "Category cannot be its own parent");
  }

  // Check if new parent exists and update ancestors
  let level = 0;
  let ancestors = [];
  if (parent) {
    const parentCategory = await Category.findById(parent);
    if (!parentCategory) throw new ApiError(404, "Parent category not found");

    // Check if new parent is not one of the category's descendants
    const descendants = await Category.find({ "ancestors._id": categoryId });
    if (descendants.some((desc) => desc._id.toString() === parent)) {
      throw new ApiError(400, "Cannot set a descendant as parent");
    }

    level = parentCategory.level + 1;
    ancestors = [
      ...parentCategory.ancestors,
      {
        _id: parentCategory._id,
        name: parentCategory.name,
        slug: parentCategory.slug,
      },
    ];
  }

  // Update the category
  category.name = name || category.name;
  category.description = description || category.description;
  category.parent = parent || category.parent;
  category.ancestors = ancestors;
  category.level = level;
  category.image = image || category.image;
  category.icon = icon || category.icon;
  category.attributes = attributes || category.attributes;
  category.isActive = isActive !== undefined ? isActive : category.isActive;
  category.sortOrder = sortOrder !== undefined ? sortOrder : category.sortOrder;
  category.seo = seo || category.seo;

  await category.save();

  // Update all descendant categories' ancestors and levels
  const descendants = await Category.find({ "ancestors._id": categoryId });
  for (const descendant of descendants) {
    const ancestorIndex = descendant.ancestors.findIndex(
      (a) => a._id.toString() === categoryId
    );
    const newAncestors = [
      ...ancestors,
      {
        _id: category._id,
        name: category.name,
        slug: category.slug,
      },
      ...descendant.ancestors.slice(ancestorIndex + 1),
    ];
    descendant.ancestors = newAncestors;
    descendant.level = newAncestors.length;
    await descendant.save();
  }

  res.json({
    success: true,
    data: category,
  });
});

exports.deleteCategory = asyncHandler(async (req, res) => {
  const categoryId = req.params.id;
  const category = await Category.findById(categoryId);

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  // Check if category has subcategories
  const hasSubcategories = await Category.exists({ parent: categoryId });
  if (hasSubcategories) {
    throw new ApiError(
      400,
      "Cannot delete category with subcategories. Please delete or reassign subcategories first."
    );
  }

  // Check if category is being used by products
  const Product = require("../models/Product");
  const hasProducts = await Product.exists({ category: categoryId });
  if (hasProducts) {
    throw new ApiError(
      400,
      "Cannot delete category that has associated products. Please reassign or delete products first."
    );
  }

  await category.deleteOne();

  res.json({
    success: true,
    message: "Category deleted successfully",
  });
});
