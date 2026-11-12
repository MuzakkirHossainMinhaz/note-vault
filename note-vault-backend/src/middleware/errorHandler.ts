import { ErrorRequestHandler, RequestHandler } from "express";
import mongoose from "mongoose";
import { HttpError } from "../utils/httpError";

type MongoError = Error & { code?: number };
type BodyParserError = Error & { type?: string; status?: number; statusCode?: number };

function notFound(_req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]): void {
  res.status(404).json({ error: { message: "Not found" } });
}

const errorHandler: ErrorRequestHandler = (rawError, _req, res, next) => {
  if (res.headersSent) {
    next(rawError);
    return;
  }

  const err = rawError as BodyParserError & MongoError & HttpError;
  if (err.type === "entity.parse.failed") {
    res.status(400).json({ error: { message: "Invalid JSON" } });
    return;
  }

  if (err.type === "entity.too.large" || err.status === 413) {
    res.status(413).json({ error: { message: "Payload too large" } });
    return;
  }

  if (err.code === 11000) {
    res.status(409).json({ error: { message: "Email already in use" } });
    return;
  }

  if (err.name === "CastError") {
    res.status(400).json({ error: { message: "Invalid id" } });
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((issue) => ({
      path: issue.path,
      message: issue.message,
    }));
    res.status(400).json({ error: { message: "Validation failed", details } });
    return;
  }

  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    console.error(err);
  }

  const body: { error: { message: string; details?: unknown } } = {
    error: {
      message: status >= 500 ? "Internal server error" : err.message,
    },
  };

  if (err.details !== undefined) {
    body.error.details = err.details;
  }

  res.status(status).json(body);
};

export { errorHandler, notFound };
