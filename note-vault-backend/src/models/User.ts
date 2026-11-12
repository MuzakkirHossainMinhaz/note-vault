import bcrypt from "bcryptjs";
import mongoose, { Document } from "mongoose";

/**
 * Query -> Index that serves it
 * -----------------------------------------------------------------
 * Login by email / unique email constraint      { email: 1 } unique
 * Interest groups $match on interests           { interests: 1 } multikey
 * Admin list all users (sort _id desc)          default _id
 * GET /users/:id, GET /users/me, auth reload    default _id
 * Update / delete user by id                    default _id
 */

const INTEREST_LIMIT = 20;
const INTEREST_MAX_LENGTH = 30;

export type UserRole = "user" | "admin";

export interface UserDocument extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  interests: string[];
  comparePassword(candidate: string): Promise<boolean>;
}

function normalizeInterests(interests: string[]): string[] {
  if (!Array.isArray(interests)) return [];

  const seen = new Set();
  const normalized = [];

  for (const item of interests) {
    if (typeof item !== "string") continue;
    const value = item.trim().toLowerCase();
    if (!value || value.length > INTEREST_MAX_LENGTH || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
    if (normalized.length === INTEREST_LIMIT) break;
  }

  return normalized;
}

const userSchema = new mongoose.Schema<UserDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    interests: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true },
);

// Unfiltered user lists and every lookup by _id are covered by the default
// _id index. ObjectIds are time-ordered, and every collection list sorts by
// _id descending, so no extra index is declared for those queries.
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ interests: 1 });

userSchema.pre("save", async function hashAndNormalize() {
  if (this.isModified("interests")) {
    this.interests = normalizeInterests(this.interests);
  }

  if (!this.isModified("password")) return;

  const parsedCost = Number(process.env.BCRYPT_COST);
  const cost = Number.isInteger(parsedCost) ? parsedCost : 12;
  this.password = await bcrypt.hash(this.password, cost);
});

userSchema.methods.comparePassword = function comparePassword(candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

function hideSecrets(_doc: unknown, ret: Record<string, any>): Record<string, any> {
  delete ret.password;
  delete ret.__v;
  return ret;
}

userSchema.set("toJSON", { transform: hideSecrets });
userSchema.set("toObject", { transform: hideSecrets });

const User = mongoose.model<UserDocument>("User", userSchema);

export default User;
