export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export default function httpError(status: number, message: string, details?: unknown): HttpError {
  return new HttpError(status, message, details);
}
