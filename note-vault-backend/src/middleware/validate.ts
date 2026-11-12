import { RequestHandler } from "express";
import { ZodError, ZodTypeAny } from "zod";
import httpError from "../utils/httpError";

interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

function formatIssues(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, _res, next): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body ?? {});
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query ?? {});
      }
      if (schemas.params) {
        const parsed = schemas.params.parse(req.params ?? {});
        Object.assign(req.params, parsed);
      }
      next();
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        next(httpError(400, "Validation failed", formatIssues(error)));
        return;
      }
      next(error);
    }
  };
}

export default validate;
