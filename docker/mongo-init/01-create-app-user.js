// docker/mongo-init/01-create-app-user.js
// MongoDB container PEHLI baar (khaali volume par) start hote waqt ye script chalti hai.
// App ke liye alag user banata hai jise sirf "ecommerce" database ka readWrite milta hai
// (root user app ko kabhi nahi dete: least privilege).
const appUser = process.env.MONGO_APP_USERNAME;
const appPassword = process.env.MONGO_APP_PASSWORD;
const appDb = process.env.MONGO_APP_DATABASE || "ecommerce";

if (!appUser || !appPassword) {
	throw new Error("MONGO_APP_USERNAME and MONGO_APP_PASSWORD must be set");
}

db.getSiblingDB(appDb).createUser({
	user: appUser,
	pwd: appPassword,
	roles: [{ role: "readWrite", db: appDb }],
});

print(`[mongo-init] created user '${appUser}' with readWrite on '${appDb}'`);