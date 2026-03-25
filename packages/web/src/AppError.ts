export class AppError extends Error {}

export class NativeRequiredError extends AppError {
  constructor() {
    super("This feature only works in the app");
  }
}
