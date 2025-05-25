const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: [true, "firstname must be required"] },
  lastName: { type: String, required: [true, "lastname must be required"] },
  email: {
    type: String,
    required: [true, "email must be required"],
    unique: [true, "email must be unique"],
    match: [
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      "Please enter a valid email address",
    ],
  },
  password: { type: String, required: [true, "password must be required"] },
  dateOfBirth: {
    type: Date,
    required: [true, "date of birth must be required"],
  }, // For age verification (21+)
  phone: { type: String, required: [true, "phone must be required"] },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
  },
  role: {
    type: String,
    enum: ["customer", "driver", "admin"],
    default: "customer",
  },
  loyaltyPoints: { type: Number, default: 0 },
  loyaltyTier: {
    type: String,
    enum: ["bronze", "silver", "gold", "platinum"],
    default: "bronze",
  },
  verified: { type: Boolean, default: false },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

userSchema.methods.calculateLoyaltyTier = function () {
  const points = this.loyaltyPoints;
  if (points >= 1000) return "platinum";
  if (points >= 500) return "gold";
  if (points >= 200) return "silver";
  return "bronze";
};

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

const UserModel = mongoose.model("User", userSchema);
module.exports = UserModel;
