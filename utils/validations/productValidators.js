const { body, param, query } = require("express-validator");

exports.createProductValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Product name is required")
    .isLength({ max: 100 })
    .withMessage("Name cannot exceed 100 characters"),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ max: 2000 })
    .withMessage("Description cannot exceed 2000 characters"),

  body("category")
    .isIn(["men", "women", "kids", "accessories", "footwear"])
    .withMessage("Invalid category"),

  body("subcategory")
    .optional()
    .isIn([
      "shirts",
      "pants",
      "dresses",
      "jackets",
      "jeans",
      "activewear",
      "underwear",
      "socks",
    ])
    .withMessage("Invalid subcategory"),

  body("brand").trim().notEmpty().withMessage("Brand is required"),

  body("sizeOptions")
    .optional()
    .isArray()
    .withMessage("Size options must be an array")
    .custom((sizes) => {
      const validSizes = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
      return sizes.every((size) => validSizes.includes(size));
    })
    .withMessage("Invalid size option provided"),

  body("colorOptions")
    .optional()
    .isArray()
    .withMessage("Color options must be an array")
    .custom((colors) => {
      const validColors = [
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
      ];
      return colors.every((color) => validColors.includes(color));
    })
    .withMessage("Invalid color option provided"),

  body("price")
    .isFloat({ min: 0.01 })
    .withMessage("Price must be a positive number"),

  body("discountPrice")
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage("Discount price must be a positive number")
    .custom((value, { req }) => value < req.body.price)
    .withMessage("Discount price must be less than regular price"),

  body("sku")
    .trim()
    .notEmpty()
    .withMessage("SKU is required")
    .isLength({ max: 50 })
    .withMessage("SKU cannot exceed 50 characters"),

  body("material")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Material cannot exceed 100 characters"),

  body("images")
    .optional()
    .isArray({ max: 10 })
    .withMessage("Maximum 10 images allowed")
    .custom((images) => images.every((img) => typeof img === "string"))
    .withMessage("Images must be URLs"),

  body("quantity")
    .notEmpty()
    .withMessage("Quantity is required")
    .custom((value) => {
      if (typeof value === "number") {
        return value >= 0;
      }
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        return Object.values(value).every(
          (qty) => Number.isInteger(qty) && qty >= 0
        );
      }
      return false;
    })
    .withMessage(
      "Quantity must be a non-negative number or an object with non-negative integer quantities"
    ),
];

// exports.updateProductValidator = [
//   param("id").isMongoId().withMessage("Invalid product ID"),

//   body("name")
//     .optional()
//     .trim()
//     .notEmpty()
//     .withMessage("Product name cannot be empty")
//     .isLength({ max: 100 })
//     .withMessage("Name cannot exceed 100 characters"),

//   // Include other fields as needed, similar to createProductValidator
//   // but make them optional
// ];

// exports.productIdValidator = [
//   param("id").isMongoId().withMessage("Invalid product ID"),
// ];

// exports.updateInventoryValidator = [
//   param("id").isMongoId().withMessage("Invalid product ID"),

//   body("variant")
//     .optional()
//     .isString()
//     .withMessage("Variant must be a string")
//     .matches(/^[A-Z]+-[a-z]+$/)
//     .withMessage('Variant must be in format "SIZE-color"'),

//   body("quantity")
//     .isInt({ min: 0 })
//     .withMessage("Quantity must be a positive integer"),
// ];

// exports.getProductsValidator = [
//   query("page")
//     .optional()
//     .isInt({ min: 1 })
//     .withMessage("Page must be a positive integer"),

//   query("limit")
//     .optional()
//     .isInt({ min: 1, max: 100 })
//     .withMessage("Limit must be between 1 and 100"),

//   query("sort").optional().isString().withMessage("Sort must be a string"),

//   query("fields").optional().isString().withMessage("Fields must be a string"),

//   query("category")
//     .optional()
//     .isIn(["men", "women", "kids", "accessories", "footwear"])
//     .withMessage("Invalid category filter"),

//   query("price")
//     .optional()
//     .matches(/^\d+-\d+$/)
//     .withMessage('Price range must be in format "min-max"'),
// ];
