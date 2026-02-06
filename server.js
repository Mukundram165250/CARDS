const express = require("express");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret_key";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change_this_password";
const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || "mukundram165250@gmail.com";

const PRODUCTS_FILE = path.join(__dirname, "products.json");

app.use(express.json());
app.use(express.static(__dirname));

function readProducts() {
  try {
    const raw = fs.readFileSync(PRODUCTS_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      return [];
    }
    return data;
  } catch (err) {
    console.warn("Could not read products.json, returning empty list.", err);
    return [];
  }
}

function writeProducts(products) {
  try {
    fs.writeFileSync(
      PRODUCTS_FILE,
      JSON.stringify(products, null, 2),
      "utf-8"
    );
  } catch (err) {
    console.error("Failed to write products.json", err);
    throw err;
  }
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

let cachedTransporter = null;

function getEmailTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const { MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS, MAIL_SECURE } =
    process.env;

  if (!MAIL_HOST || !MAIL_PORT || !MAIL_USER || !MAIL_PASS) {
    console.warn(
      "Email is not fully configured (MAIL_HOST/MAIL_PORT/MAIL_USER/MAIL_PASS)."
    );
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host: MAIL_HOST,
    port: Number(MAIL_PORT),
    secure: MAIL_SECURE === "true",
    auth: {
      user: MAIL_USER,
      pass: MAIL_PASS,
    },
  });

  return cachedTransporter;
}

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required." });
  }

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const token = jwt.sign(
    { username: ADMIN_USERNAME, role: "admin" },
    JWT_SECRET,
    { expiresIn: "2h" }
  );

  res.json({ token });
});

app.get("/api/products", (req, res) => {
  const products = readProducts();
  res.json(products);
});

app.post("/api/products", authMiddleware, (req, res) => {
  const { name, description, price, category } = req.body || {};

  if (!name || !description) {
    return res
      .status(400)
      .json({ error: "Name and description are required." });
  }

  const products = readProducts();
  const id = `prod-${Date.now()}`;

  const newProduct = {
    id,
    name,
    description,
    price: typeof price === "number" ? price : null,
    category: category || null,
  };

  products.push(newProduct);
  writeProducts(products);

  res.status(201).json(newProduct);
});

app.put("/api/products/:id", authMiddleware, (req, res) => {
  const { id } = req.params;
  const { name, description, price, category } = req.body || {};

  const products = readProducts();
  const index = products.findIndex((p) => p.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Product not found." });
  }

  const updated = {
    ...products[index],
    name: name ?? products[index].name,
    description: description ?? products[index].description,
    price:
      typeof price === "number" || price === null
        ? price
        : products[index].price,
    category: category ?? products[index].category,
  };

  products[index] = updated;
  writeProducts(products);

  res.json(updated);
});

app.delete("/api/products/:id", authMiddleware, (req, res) => {
  const { id } = req.params;
  const products = readProducts();
  const index = products.findIndex((p) => p.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Product not found." });
  }

  const [removed] = products.splice(index, 1);
  writeProducts(products);

  res.json({ success: true, removed });
});

app.post("/api/orders", async (req, res) => {
  const {
    name,
    email,
    phone,
    cardType,
    quantity,
    message: orderMessage,
  } = req.body || {};

  if (!name || !email || !orderMessage) {
    return res.status(400).json({
      error: "Name, email, and order details are required.",
    });
  }

  const transporter = getEmailTransporter();
  if (!transporter) {
    return res.status(500).json({
      error:
        "Email is not configured on the server. Please contact us directly using the contact details on the website.",
    });
  }

  const safeQuantity =
    typeof quantity === "number" && quantity > 0 ? quantity : null;

  const orderSummaryLines = [
    `Name: ${name}`,
    `Email: ${email}`,
    phone ? `Phone: ${phone}` : null,
    cardType ? `Card type: ${cardType}` : null,
    safeQuantity ? `Quantity: ${safeQuantity}` : null,
    "",
    "Order details:",
    orderMessage,
  ].filter(Boolean);

  const adminMail = {
    from: process.env.MAIL_USER,
    to: ADMIN_EMAIL,
    subject: "New card order request from your website",
    text: orderSummaryLines.join("\n"),
  };

  const customerMail = {
    from: process.env.MAIL_USER,
    to: email,
    subject: "We received your card order request",
    text: [
      `Hi ${name},`,
      "",
      "Thank you for reaching out about your card order. Here is a copy of what you sent us:",
      "",
      ...orderSummaryLines,
      "",
      "We will review your request and get back to you as soon as possible with options, pricing, and next steps.",
      "",
      "Best regards,",
      "Card Boutique",
    ].join("\n"),
  };

  try {
    await Promise.all([
      transporter.sendMail(adminMail),
      transporter.sendMail(customerMail),
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error("Error sending order emails:", err);
    res.status(500).json({
      error:
        "We could not send emails right now. Please try again later or contact us directly.",
    });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

