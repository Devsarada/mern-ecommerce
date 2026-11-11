// backend/scripts/seed.js
// Database mein shuruaati data: 1 admin user + sample products (har category ke 2).
// Baar-baar chalane par duplicate nahi banta (idempotent).
//
// Chalane ke tareeke:
//   Compose:  docker compose --profile tools run --rm seed
//   Laptop:   node --env-file=.env backend/scripts/seed.js
//
// Zaroori env: MONGO_URI, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD (kam se kam 12 characters)
// Optional:    SEED_ADMIN_NAME, UPSTASH_REDIS_URL (featured cache saaf karne ke liye),
//              SEED_FORCE_ADMIN_PASSWORD=true (admin pehle se ho to bhi password reset)
import mongoose from "mongoose";
import Redis from "ioredis";
import User from "../models/user.model.js";
import Product from "../models/product.model.js";

const {
	MONGO_URI,
	UPSTASH_REDIS_URL,
	SEED_ADMIN_NAME = "Store Admin",
	SEED_ADMIN_EMAIL,
	SEED_ADMIN_PASSWORD,
	SEED_FORCE_ADMIN_PASSWORD,
} = process.env;

// Images frontend ke public folder mein pehle se hain (Nginx serve karta hai)
const PRODUCTS = [
	{ name: "Classic Blue Jeans", category: "jeans", price: 49.99, image: "/jeans.jpg", isFeatured: true },
	{ name: "Slim Fit Black Jeans", category: "jeans", price: 59.99, image: "/jeans.jpg" },
	{ name: "Plain White T-shirt", category: "t-shirts", price: 14.99, image: "/tshirts.jpg", isFeatured: true },
	{ name: "Graphic Print T-shirt", category: "t-shirts", price: 19.99, image: "/tshirts.jpg" },
	{ name: "Everyday Sneakers", category: "shoes", price: 79.99, image: "/shoes.jpg", isFeatured: true },
	{ name: "Leather Formal Shoes", category: "shoes", price: 119.99, image: "/shoes.jpg" },
	{ name: "Aviator Sunglasses", category: "glasses", price: 89.99, image: "/glasses.png" },
	{ name: "Round Reading Glasses", category: "glasses", price: 39.99, image: "/glasses.png" },
	{ name: "Denim Jacket", category: "jackets", price: 99.99, image: "/jackets.jpg", isFeatured: true },
	{ name: "Winter Puffer Jacket", category: "jackets", price: 149.99, image: "/jackets.jpg" },
	{ name: "Navy Two-Piece Suit", category: "suits", price: 249.99, image: "/suits.jpg" },
	{ name: "Charcoal Slim Suit", category: "suits", price: 279.99, image: "/suits.jpg" },
	{ name: "Canvas Backpack", category: "bags", price: 44.99, image: "/bags.jpg", isFeatured: true },
	{ name: "Leather Tote Bag", category: "bags", price: 129.99, image: "/bags.jpg" },
];

const fail = (msg) => {
	console.error(`[seed] ERROR: ${msg}`);
	process.exit(1);
};

const validate = () => {
	if (!MONGO_URI) fail("MONGO_URI is not set");
	if (!SEED_ADMIN_EMAIL) fail("SEED_ADMIN_EMAIL is not set");
	if (!SEED_ADMIN_PASSWORD) fail("SEED_ADMIN_PASSWORD is not set");
	if (SEED_ADMIN_PASSWORD.length < 12) fail("SEED_ADMIN_PASSWORD must be at least 12 characters");
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(SEED_ADMIN_EMAIL)) fail("SEED_ADMIN_EMAIL is not a valid email");
};

const seedAdmin = async () => {
	const email = SEED_ADMIN_EMAIL.toLowerCase().trim();
	const existing = await User.findOne({ email });

	if (!existing) {
		await User.create({ name: SEED_ADMIN_NAME, email, password: SEED_ADMIN_PASSWORD, role: "admin" });
		console.log(`[seed] admin created: ${email}`);
		return;
	}

	let changed = false;
	if (existing.role !== "admin") {
		existing.role = "admin";
		changed = true;
		console.log(`[seed] existing user promoted to admin: ${email}`);
	}
	if (SEED_FORCE_ADMIN_PASSWORD === "true") {
		existing.password = SEED_ADMIN_PASSWORD; // pre-save hook hash karega
		changed = true;
		console.log(`[seed] admin password reset: ${email}`);
	}
	if (changed) await existing.save();
	else console.log(`[seed] admin already exists, unchanged: ${email}`);
};

const seedProducts = async () => {
	let inserted = 0;
	for (const p of PRODUCTS) {
		// Sirf naya product daalo; admin ne jo badla hai use overwrite mat karo
		const res = await Product.updateOne(
			{ name: p.name },
			{
				$setOnInsert: {
					...p,
					description: `${p.name} - sample product added by the seed script.`,
					isFeatured: Boolean(p.isFeatured),
				},
			},
			{ upsert: true }
		);
		inserted += res.upsertedCount;
	}
	const total = await Product.countDocuments();
	console.log(`[seed] products inserted: ${inserted}, already present: ${PRODUCTS.length - inserted}, total in DB: ${total}`);
	return inserted;
};

// Naye featured products dikhne ke liye Redis ka purana cache hatao
const clearFeaturedCache = async () => {
	if (!UPSTASH_REDIS_URL) {
		console.log("[seed] UPSTASH_REDIS_URL not set, skipping cache clear");
		return;
	}
	const redis = new Redis(UPSTASH_REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 5000, lazyConnect: true });
	try {
		await redis.connect();
		await redis.del("featured_products");
		console.log("[seed] redis cache 'featured_products' cleared");
	} catch (err) {
		console.warn(`[seed] WARNING: could not clear redis cache (${err.message}). Featured list may be stale until it is cleared.`);
	} finally {
		redis.disconnect();
	}
};

const main = async () => {
	validate();
	try {
		await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
		console.log(`[seed] connected to MongoDB: ${mongoose.connection.host}/${mongoose.connection.name}`);
		await seedAdmin();
		await seedProducts();
		await clearFeaturedCache();
		console.log("[seed] done");
	} catch (err) {
		fail(err.message);
	} finally {
		await mongoose.disconnect();
	}
};

main();