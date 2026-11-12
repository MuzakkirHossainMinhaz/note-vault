import { RequestHandler } from "express";
import { UserRole } from "../models/User";
import httpError from "../utils/httpError";

function requireRole(role: UserRole): RequestHandler {
  return (req, _res, next): void => {
    if (!req.user || req.user.role !== role) {
      next(httpError(403, "Forbidden"));
      return;
    }
    next();
  };
}

export default requireRole;
