import { bi } from "@tracker/shared/i18n";

/** An error whose message is safe to show to the user (a `bi()` string, localized when sent). `code` lets clients react to specific cases. */
export class HttpError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message: string, code?: string) => new HttpError(400, message, code);
export const unauthorized = (message = bi("Please sign in", "กรุณาเข้าสู่ระบบ")) => new HttpError(401, message, "UNAUTHENTICATED");
export const notFound = (message = bi("Not found", "ไม่พบข้อมูล")) => new HttpError(404, message);
