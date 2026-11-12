import jwt from "jsonwebtoken";
import env from "../config/env";
import User from "../models/User";
import asyncHandler from "../utils/asyncHandler";
import httpError from "../utils/httpError";

const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw httpError(401, "Authentication required");
  }

  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
  } catch {
    throw httpError(401, "Invalid or expired token");
  }

  if (typeof payload !== "object" || typeof payload.sub !== "string") {
    throw httpError(401, "Invalid or expired token");
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    throw httpError(401, "Invalid or expired token");
  }

  req.user = user;
  next();
});

export default authenticate;
