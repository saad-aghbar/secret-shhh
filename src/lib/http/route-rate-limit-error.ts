export class RouteRateLimitError extends Error {
  readonly status = 429;

  constructor(message = "Try again in a moment.") {
    super(message);
    this.name = "RouteRateLimitError";
  }
}
