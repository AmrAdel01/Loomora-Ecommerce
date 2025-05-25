const express = require("express");
const dotenv = require("dotenv");
const morgan = require("morgan");
const cors = require("cors");
dotenv.config();

//Routes
const connectDB = require("./config/db");
const authRouter = require("./routes/auth");
const productRouter = require("./routes/products");
const cartRouter = require("./routes/cart");
const couponRouter = require("./routes/coupon");
const categoryRouter = require("./routes/category");

// Middleware
const globalErrorHandler = require("./middleware/errorHandler");
const routeNotFoundHandler = require("./middleware/routeNotFoundHandler");

// Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Development mode
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
  console.log(`${process.env.NODE_ENV} mode is running`);
}

// Routes
app.get("/", (req, res) => {
  res.send("Hello World");
});

// Routes hook
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/products", productRouter);
app.use("/api/v1/cart", cartRouter);
app.use("/api/v1/", couponRouter);
app.use("/api/v1/categories", categoryRouter);

// Error Handling
app.use(routeNotFoundHandler);
app.use(globalErrorHandler);

// Server
const PORT = process.env.PORT || 8080;

// Start the server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.log(`Error: ${error.message}`);
    process.exit(1);
  }
};

startServer();
