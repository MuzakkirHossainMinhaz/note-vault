import { RequestHandler } from "express";

function asyncHandler(fn: RequestHandler): RequestHandler {
  return function wrapped(req, res, next): void {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default asyncHandler;
