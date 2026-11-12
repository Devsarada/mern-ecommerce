// infra/secrets/check-secret.mjs
// Secrets Manager ka secret padhkar CHECK karta hai ki saari zaroori keys hain aur values sahi format mein hain.
// Values kabhi screen par print NAHI karta (sirf key ke naam aur OK / problem).
//
// Chalane ke tareeke:
//   node infra/secrets/check-secret.mjs mern/staging
//   node infra/secrets/check-secret.mjs mern/prod
//   node infra/secrets/check-secret.mjs --file some-local.json      (bina AWS ke test)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
if (args.length === 0) {
	console.error("Usage: node infra/secrets/check-secret.mjs <secret-id> | --file <path>");
	process.exit(2);
}

let raw;
let label;
if (args[0] === "--file") {
	label = args[1];
	raw = readFileSync(args[1], "utf8");
} else {
	label = args[0];
	try {
		raw = execFileSync(
			"aws",
			["secretsmanager", "get-secret-value", "--secret-id", args[0], "--query", "SecretString", "--output", "text"],
			{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" }
		);
	} catch (err) {
		console.error(`Could not read secret '${args[0]}': ${(err.stderr || err.message).toString().trim()}`);
		process.exit(1);
	}
}

let data;
try {
	data = JSON.parse(raw);
} catch {
	console.error("Secret value is not valid JSON (use key/value pairs or a JSON object).");
	process.exit(1);
}

const isProd = /prod/i.test(label);
const PLACEHOLDER = /^(change-me|your_|generate-|TO_BE_SET|SET_IN_|xxx|placeholder)/i;

// [key, check function, problem message, required]
const rules = [
	["MONGO_URI", (v) => /^mongodb(\+srv)?:\/\/[^:]+:[^@]+@[^/]+\/ecommerce(\?|$)/.test(v), "must look like mongodb+srv://USER:PASS@HOST/ecommerce?...", true],
	["UPSTASH_REDIS_URL", (v) => /^rediss?:\/\//.test(v), "must start with redis:// or rediss://", true],
	["ACCESS_TOKEN_SECRET", (v) => v.length >= 32, "must be at least 32 characters", true],
	["REFRESH_TOKEN_SECRET", (v) => v.length >= 32, "must be at least 32 characters", true],
	["STRIPE_SECRET_KEY", (v) => /^sk_test_/.test(v) || (isProd && /^sk_live_/.test(v)), "must start with sk_test_ (sk_live_ allowed only in prod)", true],
	["CLOUDINARY_CLOUD_NAME", (v) => v.length > 0, "must not be empty", true],
	["CLOUDINARY_API_KEY", (v) => /^\d+$/.test(v), "must be digits only", true],
	["CLOUDINARY_API_SECRET", (v) => v.length >= 10, "looks too short", true],
	["SEED_ADMIN_EMAIL", (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "must be a valid email", true],
	["SEED_ADMIN_PASSWORD", (v) => v.length >= 12, "must be at least 12 characters", true],
	["REDIS_PASSWORD", (v) => /^[A-Za-z0-9]{16,}$/.test(v), "must be 16+ letters/numbers (used in a URL)", !isProd],
];

let problems = 0;
console.log(`Checking secret: ${label}`);
for (const [key, check, msg, required] of rules) {
	const value = data[key];
	if (value === undefined || value === "") {
		if (required) {
			console.log(`  MISSING  ${key}`);
			problems++;
		}
		continue;
	}
	if (typeof value !== "string") {
		console.log(`  PROBLEM  ${key}: must be a string`);
		problems++;
	} else if (PLACEHOLDER.test(value)) {
		console.log(`  PENDING  ${key}: still a placeholder`);
		problems++;
	} else if (value !== value.trim()) {
		console.log(`  PROBLEM  ${key}: has leading/trailing spaces`);
		problems++;
	} else if (!check(value)) {
		console.log(`  PROBLEM  ${key}: ${msg}`);
		problems++;
	} else {
		console.log(`  OK       ${key}`);
	}
}

if (data.ACCESS_TOKEN_SECRET && data.ACCESS_TOKEN_SECRET === data.REFRESH_TOKEN_SECRET) {
	console.log("  PROBLEM  ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be different");
	problems++;
}
const known = new Set(rules.map((r) => r[0]));
for (const key of Object.keys(data)) if (!known.has(key)) console.log(`  NOTE     extra key '${key}' (not checked)`);

console.log(problems === 0 ? "RESULT: all good" : `RESULT: ${problems} problem(s) found`);
process.exit(problems === 0 ? 0 : 1);