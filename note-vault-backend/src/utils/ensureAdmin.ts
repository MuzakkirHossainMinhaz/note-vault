import User from "../models/User";

async function ensureAdmin(): Promise<{ created: boolean }> {
  const email = process.env.ADMIN_EMAIL!.trim().toLowerCase();
  const existing = await User.findOne({ email }).select("_id");

  if (existing) {
    console.log(`Admin seed skipped; a user with email ${email} already exists`);
    return { created: false };
  }

  await User.create({
    name: process.env.ADMIN_NAME!.trim(),
    email,
    password: process.env.ADMIN_PASSWORD,
    role: "admin",
    interests: [],
  });

  console.log(`Admin seed created for ${email}`);
  return { created: true };
}

export default ensureAdmin;
