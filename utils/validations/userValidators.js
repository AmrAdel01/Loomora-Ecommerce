const { body, param, query } = require("express-validator");
const User = require("../../models/User");

// Common validation messages
const messages = {
  required: "This field is required",
  email: "Please provide a valid email address",
  passwordLength: "Password must be at least 8 characters long",
  passwordMatch: "Passwords do not match",
  invalidDate: "Invalid date format (YYYY-MM-DD)",
  ageRestriction: "You must be at least 16 years old to register",
  phone: "Please provide a valid phone number",
  zipCode: "Please provide a valid ZIP code",
};

// Helper function to calculate age from date of birth
const calculateAge = (dob) => {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
};

exports.signupValidator = [
  body("firstName")
    .trim()
    .notEmpty()
    .withMessage(messages.required)
    .isLength({ max: 50 })
    .withMessage("First name cannot exceed 50 characters")
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage("First name contains invalid characters"),

  body("lastName")
    .trim()
    .notEmpty()
    .withMessage(messages.required)
    .isLength({ max: 50 })
    .withMessage("Last name cannot exceed 50 characters")
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage("Last name contains invalid characters"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage(messages.required)
    .isEmail()
    .withMessage(messages.email)
    .normalizeEmail()
    .custom(async (email) => {
      const user = await User.findOne({ email });
      if (user) {
        throw new Error("Email already in use");
      }
    }),

  body("password")
    .trim()
    .notEmpty()
    .withMessage(messages.required)
    .isLength({ min: 8 })
    .withMessage(messages.passwordLength)
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
    )
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, one number and one special character"
    ),

  body("confirmPassword")
    .trim()
    .notEmpty()
    .withMessage(messages.required)
    .custom((value, { req }) => value === req.body.password)
    .withMessage(messages.passwordMatch),

  body("dateOfBirth")
    .notEmpty()
    .withMessage(messages.required)
    .isISO8601()
    .withMessage(messages.invalidDate)
    .custom((dob) => {
      const age = calculateAge(dob);
      if (age < 16) {
        throw new Error(messages.ageRestriction);
      }
      return true;
    }),

  body("phone").optional().trim().isMobilePhone().withMessage(messages.phone),

  body("address.street")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Street address cannot exceed 100 characters"),

  body("address.city")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("City cannot exceed 50 characters"),

  body("address.state")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("State cannot exceed 50 characters"),

  body("address.zipCode")
    .optional()
    .trim()
    .isPostalCode("any")
    .withMessage(messages.zipCode),
];

exports.loginValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage(messages.required)
    .isEmail()
    .withMessage(messages.email)
    .normalizeEmail(),

  body("password").trim().notEmpty().withMessage(messages.required),
];

exports.updateUserValidator = [
  param("id").isMongoId().withMessage("Invalid user ID"),

  body("firstName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage(messages.required)
    .isLength({ max: 50 })
    .withMessage("First name cannot exceed 50 characters")
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage("First name contains invalid characters"),

  body("lastName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage(messages.required)
    .isLength({ max: 50 })
    .withMessage("Last name cannot exceed 50 characters")
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage("Last name contains invalid characters"),

  body("email")
    .optional()
    .trim()
    .isEmail()
    .withMessage(messages.email)
    .normalizeEmail()
    .custom(async (email, { req }) => {
      const user = await User.findOne({ email });
      if (user && user._id.toString() !== req.params.id) {
        throw new Error("Email already in use");
      }
    }),

  body("dateOfBirth")
    .optional()
    .isISO8601()
    .withMessage(messages.invalidDate)
    .custom((dob) => {
      const age = calculateAge(dob);
      if (age < 16) {
        throw new Error(messages.ageRestriction);
      }
      return true;
    }),

  body("phone").optional().trim().isMobilePhone().withMessage(messages.phone),

  body("address")
    .optional()
    .isObject()
    .withMessage("Address must be an object"),

  body("address.street")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Street address cannot exceed 100 characters"),

  body("address.city")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("City cannot exceed 50 characters"),

  body("address.state")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("State cannot exceed 50 characters"),

  body("address.zipCode")
    .optional()
    .trim()
    .isPostalCode("any")
    .withMessage(messages.zipCode),
];

exports.changePasswordValidator = [
  param("id").isMongoId().withMessage("Invalid user ID"),

  body("currentPassword").trim().notEmpty().withMessage(messages.required),

  body("newPassword")
    .trim()
    .notEmpty()
    .withMessage(messages.required)
    .isLength({ min: 8 })
    .withMessage(messages.passwordLength)
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
    )
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, one number and one special character"
    )
    .custom((value, { req }) => value !== req.body.currentPassword)
    .withMessage("New password must be different from current password"),

  body("confirmPassword")
    .trim()
    .notEmpty()
    .withMessage(messages.required)
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage(messages.passwordMatch),
];

exports.forgotPasswordValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage(messages.required)
    .isEmail()
    .withMessage(messages.email)
    .normalizeEmail(),
];

exports.resetPasswordValidator = [
  body("token").trim().notEmpty().withMessage("Token is required"),

  body("newPassword")
    .trim()
    .notEmpty()
    .withMessage(messages.required)
    .isLength({ min: 8 })
    .withMessage(messages.passwordLength)
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
    )
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, one number and one special character"
    ),

  body("confirmPassword")
    .trim()
    .notEmpty()
    .withMessage(messages.required)
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage(messages.passwordMatch),
];

exports.userIdValidator = [
  param("id").isMongoId().withMessage("Invalid user ID"),
];

exports.getUsersValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("sort").optional().isString().withMessage("Sort must be a string"),

  query("fields").optional().isString().withMessage("Fields must be a string"),

  query("role")
    .optional()
    .isIn(["customer", "driver", "admin"])
    .withMessage("Invalid role filter"),
];

exports.deleteUserValidator = [
  param("id").isMongoId().withMessage("Invalid user ID"),
];
