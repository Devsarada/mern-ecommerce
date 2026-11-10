// backend/tests/api.test.js
// Node ka built-in test runner (node:test) + supertest.
// Ye tests MongoDB ke bina chalte hain, isliye CI pipeline (Jenkins) mein seedha chal sakte hain.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "test-access-secret";
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "test-refresh-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_placeholder_not_real";

const { default: app } = await import("../app.js");
const { redis } = await import("../lib/redis.js");

after(() => {
	redis.disconnect();
});

test("GET /api/health returns 200 and status ok", async () => {
	const res = await request(app).get("/api/health");
	assert.equal(res.status, 200);
	assert.equal(res.body.status, "ok");
});

test("GET /api/ready returns 503 when MongoDB is not connected", async () => {
	const res = await request(app).get("/api/ready");
	assert.equal(res.status, 503);
	assert.equal(res.body.mongo, "down");
});

test("GET /api/auth/profile without cookie returns 401", async () => {
	const res = await request(app).get("/api/auth/profile");
	assert.equal(res.status, 401);
});

test("POST /api/payments/create-checkout-session without login returns 401", async () => {
	const res = await request(app).post("/api/payments/create-checkout-session").send({ products: [] });
	assert.equal(res.status, 401);
});

test("GET /api/cart with an invalid token returns 401", async () => {
	const res = await request(app).get("/api/cart").set("Cookie", ["accessToken=not-a-real-token"]);
	assert.equal(res.status, 401);
});

test("Unknown API route returns 404", async () => {
	const res = await request(app).get("/api/does-not-exist");
	assert.equal(res.status, 404);
});