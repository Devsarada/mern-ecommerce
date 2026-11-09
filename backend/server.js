// backend/server.js
// Sirf server start karta hai: env load, port par listen, DB connect,
// aur band hone ka signal (SIGTERM) aane par shaanti se band hona.
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import app from "./app.js";
import { connectDB } from "./lib/db.js";
import { redis } from "./lib/redis.js";

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
	console.log("Server is running on http://localhost:" + PORT);
	connectDB();
});

// Docker stop / Kubernetes rolling update SIGTERM bhejte hain (Module 5c).
// Yahan naye connections band karke, DB aur Redis band karke exit karte hain.
const shutdown = (signal) => {
	console.log(`${signal} received, shutting down gracefully...`);
	server.close(async () => {
		try {
			await mongoose.connection.close();
			await redis.quit();
		} catch (err) {
			console.log("Error during shutdown", err.message);
		}
		process.exit(0);
	});
	// 10 second mein band na ho to zabardasti exit
	setTimeout(() => process.exit(1), 10000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));