const Product = require("../models/Product");

const generateSKU = async ({ category, brand }) => {
  const categoryCode = (category || "GEN").slice(0, 3).toUpperCase();
  const brandName = (brand || "NoBrand").replace(/\s+/g, "").toUpperCase();
  const now = new Date();
  const datePart = `${now.getFullYear().toString().slice(2)}${String(
    now.getMonth() + 1
  ).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  const productCount = await Product.countDocuments({
    category,
    brand,
  });
  const serial = String(productCount + 1).padStart(4, "0");

  return `${categoryCode}-${brandName}-${datePart}-${serial}`;
};

module.exports = generateSKU;
