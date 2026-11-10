// backend/app.js
// Express app yahan banta hai, lekin server start (listen) yahan NAHI hota.
// Isse tests app ko bina port khole aur bina DB connect kiye chala sakte hain.
import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import mongoose from "mongoose";

import authRoutes from "./routes/auth.route.js";
import productRoutes from "./routes/product.route.js";
import cartRoutes from "./routes/cart.route.js";
import couponRoutes from "./routes/coupon.route.js";
import paymentRoutes from "./routes/payment.route.js";
import analyticsRoutes from "./routes/analytics.route.js";
import { redis } from "./lib/redis.js";

const app = express();
const __dirname = path.resolve();

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// Liveness: process zinda hai? (DB/Redis check nahi karta)
// Docker HEALTHCHECK aur Kubernetes livenessProbe isko use karenge.
app.get("/api/health", (req, res) => {
	res.status(200).json({ status: "ok", uptime: Math.round(process.uptime()) });
});

// Readiness: kya app traffic lene ko taiyaar hai? (MongoDB + Redis dono connected)
// Kubernetes readinessProbe aur deploy ke baad smoke test isko use karenge.
app.get("/api/ready", async (req, res) => {
	const mongoOk = mongoose.connection.readyState === 1;
	let redisOk = false;
	try {
		redisOk = redis.status === "ready" && (await redis.ping()) === "PONG";
	} catch {
		redisOk = false;
	}
	const ready = mongoOk && redisOk;
	res.status(ready ? 200 : 503).json({
		status: ready ? "ready" : "not-ready",
		mongo: mongoOk ? "up" : "down",
		redis: redisOk ? "up" : "down",
	});
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/analytics", analyticsRoutes);

// Original behaviour: single-server mode mein backend hi frontend serve karta tha.
// 3-tier setup mein frontend alag Nginx container hai, isliye ye tabhi chalega
// jab SERVE_FRONTEND=true ho.
if (process.env.NODE_ENV === "production" && process.env.SERVE_FRONTEND === "true") {
	app.use(express.static(path.join(__dirname, "/frontend/dist")));
	app.get("*", (req, res) => {
		res.sendFile(path.resolve(__dirname, "frontend", "dist", "index.html"));
	});
}

export default app;