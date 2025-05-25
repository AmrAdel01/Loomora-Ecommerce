const Product = require("../models/Product");
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const generateSKU = require("../utils/generateSKU");

const { Parser } = require("json2csv");
const redis = require("../utils/redisClient");

//admin can create product
exports.createProduct = asyncHandler(async (req, res, next) => {
  const {
    name,
    description,
    category,
    subcategory,
    brand,
    sizeOptions,
    colorOptions,
    material,
    images,
    price,
    discountPrice,
    quantity = 0,
    sku,
  } = req.body;

  let finalSKU = sku;

  // Check required fields
  if (!name || !description || !category || !brand || !price) {
    return next(new ApiError(400, "All required fields must be provided"));
  }

  // Check if SKU exists already
  if (sku) {
    const cachedSKU = await redis.get(`sku:${sku}`);
    if (cachedSKU) {
      return res.status(400).json({
        success: false,
        message: "Product with this SKU already exists (cached)",
      });
    }

    const existingProduct = await Product.findOne({ sku });
    if (existingProduct) {
      await redis.set(`sku:${sku}`, "true", { EX: 300 }); // TTL 5 دقايق
      return res.status(400).json({
        success: false,
        message: "Product with this SKU already exists",
      });
    }
  }

  if (!sku) {
    finalSKU = await generateSKU({ category, brand });
  }

  // Normalize arrays (sorted)
  const sortedSizeOptions = (sizeOptions || []).slice().sort();
  const sortedColorOptions = (colorOptions || []).slice().sort();

  // Normalize other fields
  const normalizedName = name.trim().toLowerCase();
  const normalizedCategory = category.trim().toLowerCase();
  const normalizedSubcategory = subcategory?.trim().toLowerCase();
  const normalizedBrand = brand.trim().toLowerCase();

  // Check for duplicate product based on normalized core fields
  const duplicateProduct = await Product.findOne({
    name: normalizedName,
    category: normalizedCategory,
    subcategory: normalizedSubcategory,
    brand: normalizedBrand,
    sizeOptions: sortedSizeOptions,
    colorOptions: sortedColorOptions,
    material: material || "",
  });

  if (duplicateProduct) {
    return res.status(400).json({
      success: false,
      message: "Product already exists with similar specifications",
    });
  }

  // Generate quantity map if needed
  let quantityValue = quantity;
  if (
    Array.isArray(sizeOptions) &&
    Array.isArray(colorOptions) &&
    sizeOptions.length > 0 &&
    colorOptions.length > 0
  ) {
    quantityValue = new Map();
    sizeOptions.forEach((size) => {
      colorOptions.forEach((color) => {
        const variantKey = `${size}-${color}`;
        const variantQty =
          (typeof quantity === "object" && quantity[variantKey]) || 0;
        quantityValue.set(variantKey, Math.max(0, variantQty));
      });
    });
  } else if (typeof quantityValue === "object") {
    quantityValue = new Map(Object.entries(quantityValue));
  }

  // Validate quantity before creation
  if (typeof quantityValue === "number" && quantityValue < 0) {
    return next(new ApiError(400, "Quantity cannot be negative"));
  }

  // Create the product
  const product = await Product.create({
    name: normalizedName,
    description,
    category: normalizedCategory,
    subcategory: normalizedSubcategory,
    brand: normalizedBrand,
    sizeOptions: sortedSizeOptions,
    colorOptions: sortedColorOptions,
    material,
    images,
    price,
    discountPrice,
    quantity: quantityValue,
    sku: finalSKU,
  });

  res.status(201).json({
    status: "success",
    message: "Product created successfully",
    product: {
      [`${product.name}-${product.sku}`]: product.toObject(),
    },
  });
});

//user can add comment to product
exports.addCommentToProduct = asyncHandler(async (req, res, next) => {
  const { id } = req.params; // product id
  const { text, rating } = req.body;

  if (!req.user) {
    return next(new ApiError(401, "You must be logged in to comment"));
  }

  if (!text) {
    return next(new ApiError(400, "Comment text is required"));
  }
  if (rating && (rating < 1 || rating > 5)) {
    return next(new ApiError(400, "Rating must be between 1 and 5"));
  }

  const product = await Product.findById(id);
  if (!product || product.isActive === false) {
    return next(new ApiError(404, "Product not found"));
  }

  product.comments.push({
    user: req.user._id,
    text,
    rating: rating || undefined,
  });

  await product.save();

  res.status(201).json({
    status: "success",
    message: "Comment added successfully",
    comment: product.comments[product.comments.length - 1],
  });
});

//admin can update product
exports.updateProduct = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) return next(new ApiError(404, "Product not found"));

  // Handle variant updates first
  if (req.body.sizeOptions && req.body.colorOptions) {
    product.quantity = req.body.sizeOptions.reduce((acc, size) => {
      req.body.colorOptions.forEach((color) => {
        acc[`${size}-${color}`] = req.body.quantity?.[`${size}-${color}`] || 0;
      });
      return acc;
    }, {});
  }

  // Update other fields
  const { sku, ...updates } = req.body;
  Object.assign(product, { ...updates, updatedAt: new Date() });

  // Handle SKU
  if ((updates.category || updates.brand) && !sku) {
    product.sku = await require("../utils/generateSKU")({
      category: updates.category || product.category,
      brand: updates.brand || product.brand,
    });
  }

  await product.save();
  res.status(200).json({ status: "success", data: product });
});

// admin can delete product
exports.deleteProduct = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { softDelete = false } = req.query;

  // Check if user is admin
  if (!req.user || req.user.role !== "admin") {
    return next(new ApiError(403, "Only admins can delete products"));
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const product = await Product.findById(id).session(session);
    if (!product) {
      await session.abortTransaction();
      session.endSession();
      return next(new ApiError(404, "Product not found"));
    }

    if (softDelete) {
      product.isActive = false;
      product.updatedAt = new Date();
      await product.save({ session });
    } else {
      // Hard delete: remove images and product (comments are embedded, so they’re deleted automatically)
      if (product.images.length > 0) {
        for (const image of product.images) {
          try {
            await cloudinary.uploader.destroy(image);
          } catch (error) {
            console.error(`Failed to delete image ${image}:`, error);
          }
        }
      }
      await product.deleteOne({ session });
    }

    // Log deletion event (placeholder)
    // await logEvent({
    //   userId: req.user._id,
    //   action: softDelete ? "soft_delete_product" : "hard_delete_product",
    //   productId: id,
    // });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      status: "success",
      message: softDelete
        ? "Product marked as inactive"
        : "Product and associated comments deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(new ApiError(500, "Failed to delete product", error));
  }
});

// user can delete comment
exports.deleteComment = asyncHandler(async (req, res, next) => {
  const { id, commentId } = req.params;

  // Ensure user is authenticated
  if (!req.user) {
    return next(new ApiError(401, "You must be logged in to delete a comment"));
  }

  const product = await Product.findById(id);
  if (!product || product.isActive === false) {
    return next(new ApiError(404, "Product not found"));
  }

  const comment = product.comments.id(commentId);
  if (!comment) {
    return next(new ApiError(404, "Comment not found"));
  }

  // Check if user is authorized (own comment or admin)
  if (req.user.role !== "admin" && !comment.user.equals(req.user._id)) {
    return next(new ApiError(403, "You can only delete your own comments"));
  }

  product.comments.id(commentId).deleteOne();
  await product.save();

  res.status(200).json({
    status: "success",
    message: "Comment deleted successfully",
  });
});

// admin can get product by id
exports.getProductById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { fields, populateComments = false } = req.query; // ?populateComments=true to include user details

  // Build projection object
  const projection = fields
    ? fields.split(",").reduce((acc, field) => {
        acc[field.trim()] = 1;
        return acc;
      }, {})
    : {};

  // Build query
  let query = Product.findById(id, projection);
  if (populateComments === "true") {
    query = query.populate({
      path: "comments.user",
      select: "name email", // Adjust based on User model fields
    });
  }

  const product = await query.lean();

  if (!product || (!req.user?.role === "admin" && product.isActive === false)) {
    return next(new ApiError(404, "Product not found"));
  }

  // Increment view count (placeholder)
  // await Product.updateOne({ _id: id }, { $inc: { viewCount: 1 } });

  // Cache logic (placeholder)
  // const cacheKey = `product:${id}:${fields || 'all'}:${populateComments}`;
  // const cachedProduct = await redisClient.get(cacheKey);
  // if (cachedProduct) {
  //   return res.status(200).json({
  //     status: "success",
  //     product: JSON.parse(cachedProduct),
  //   });
  // }

  // await redisClient.setEx(cacheKey, 3600, JSON.stringify(product));

  res.status(200).json({
    status: "success",
    product: {
      [`${product.name}-${product.sku}`]: product,
    },
  });
});

// admin can get all products
exports.getAllProducts = asyncHandler(async (req, res, next) => {
  //pagination
  const currentPage = parseInt(req.query.page) || 1;
  const itemsPerPage = parseInt(req.query.limit) || 20;
  const skipItems = (currentPage - 1) * itemsPerPage;

  // 2. Configure sorting
  const sortOrder = req.query.sort || "-createdAt";

  // 3. Build search query
  const searchQuery = req.query.search
    ? { $text: { $search: req.query.search } }
    : {};

  // role check
  const isAdminUser = req.user && req.user.role === "admin";

  // 4. Construct filters
  const filters = {
    ...searchQuery,
    isActive: true,
    ...(req.query.category && { category: req.query.category }),
    ...(req.query.brand && { brand: req.query.brand }),
    ...(!isAdminUser && { isActive: true }),
  };
  // admin can see inactive products
  if (isAdminUser) {
    if (req.query.isActive !== undefined) {
      filters.isActive = req.query.isActive === "true";
    }
  } else {
    filters.isActive = true;
  }
  // 5. Add price range filter if provided
  if (req.query.minPrice || req.query.maxPrice) {
    filters.price = {
      ...(req.query.minPrice && { $gte: parseFloat(req.query.minPrice) }),
      ...(req.query.maxPrice && { $lte: parseFloat(req.query.maxPrice) }),
    };
  }

  // 6. Get total count and paginated results
  const totalProducts = await Product.countDocuments(filters);
  const products = await Product.find(filters)
    .sort(sortOrder)
    .skip(skipItems)
    .limit(itemsPerPage);

  const formattedProducts = {};
  products.forEach((product) => {
    formattedProducts[`${product.name}-${product.sku}`] = product.toObject();
  });
  // 7. Send response
  res.status(200).json({
    status: "success",
    results: products.length,
    currentPage,
    totalPages: Math.ceil(totalProducts / itemsPerPage),
    products: formattedProducts,
  });
});

// Admin can toggle product active status
exports.toggleProductStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  // Check if user is admin
  if (!req.user || req.user.role !== "admin") {
    return next(new ApiError(403, "Only admins can toggle product status"));
  }

  const product = await Product.findById(id);
  if (!product) {
    return next(new ApiError(404, "Product not found"));
  }

  // Toggle the isActive status
  product.isActive = !product.isActive;
  product.updatedAt = new Date();

  await product.save();

  // Clear any related cache (optional)
  // await redis.del(`product:${id}:*`);

  res.status(200).json({
    status: "success",
    message: `Product status changed to ${
      product.isActive ? "active" : "inactive"
    }`,
    product: {
      [`${product.name}-${product.sku}`]: product.toObject(),
    },
  });
});

// Get related products
exports.getRelatedProducts = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { limit = 4 } = req.query; // Default to 4 related products

  const product = await Product.findById(id).lean();
  if (!product || (!req.user?.role === "admin" && product.isActive === false)) {
    return next(new ApiError(404, "Product not found"));
  }

  // Build query for related products
  const query = {
    _id: { $ne: id }, // Exclude the current product
    isActive: true, // Only active products for non-admins
    $or: [
      { category: product.category },
      { subcategory: product.subcategory },
      { brand: product.brand },
      { tags: { $in: product.tags } },
    ],
  };

  // Admins can see inactive related products if specified
  if (req.user?.role === "admin" && req.query.isActive !== undefined) {
    query.isActive = req.query.isActive === "true";
  }

  // Fetch related products
  const relatedProducts = await Product.find(query)
    .limit(parseInt(limit))
    .sort({ averageRating: -1, createdAt: -1 }) // Prioritize high-rated, recent products
    .lean();

  const formattedProducts = {};
  relatedProducts.forEach((prod) => {
    formattedProducts[`${prod.name}-${prod.sku}`] = prod;
  });

  res.status(200).json({
    status: "success",
    results: relatedProducts.length,
    products: formattedProducts,
  });
});

// admin can export products to csv
exports.exportProductsCSV = asyncHandler(async (req, res, next) => {
  const isAdminUser = req.user.role === "admin";

  const filters = isAdminUser ? {} : { isActive: true };

  const products = await Product.find(filters).lean();

  if (!products.length) {
    return next(new ApiError(404, "No products found"));
  }

  const fields = [
    "name",
    "description",
    "category",
    "subcategory",
    "brand",
    "price",
    "discountPrice",
    "sku",
    "isActive",
    "createdAt",
  ];
  const parser = new Parser({ fields });
  const csv = parser.parse(products);

  res.header("Content-Type", "text/csv");
  res.attachment("products.csv");
  return res.send(csv);
});
