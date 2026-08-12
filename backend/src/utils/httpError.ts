export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const notFoundError = (message: string) => new HttpError(404, message);
export const unavailable = (message: string) => new HttpError(503, message);
