import { TRPCError } from "@trpc/server";

export type ClientErrorCode = "STRAVA_INTEGRATION_REQUIRED";

export class ClientError extends TRPCError {
  clientError: ClientErrorCode;

  constructor(code: ClientErrorCode, message?: string) {
    super({ code: "BAD_REQUEST", message });
    this.clientError = code;
  }
}
