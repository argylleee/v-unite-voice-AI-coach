import { createHash, randomBytes } from "node:crypto";
import { DEFAULT_DEMO_CLINIC_ID } from "@/lib/demo-clinic";

const COOKIE_NAME = "vu_demo_visitor";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function tokenFromRequest(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const part = cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${COOKIE_NAME}=`));
  const token = part?.slice(COOKIE_NAME.length + 1) ?? "";
  return TOKEN_PATTERN.test(token) ? token : null;
}

export function visitorHash(request: Request): string | null {
  const token = tokenFromRequest(request);
  return token ? createHash("sha256").update(token).digest("hex") : null;
}

export function newOrExistingVisitor(request: Request): { hash: string; cookie: string | null } {
  const existing = tokenFromRequest(request);
  const token = existing ?? randomBytes(32).toString("base64url");
  const cookie = existing
    ? null
    : `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
  return { hash: createHash("sha256").update(token).digest("hex"), cookie };
}

export function demoClinicId(): string {
  return process.env.NEXT_PUBLIC_CLINIC_ID || DEFAULT_DEMO_CLINIC_ID;
}

export function isDemoClinic(clinicId: string): boolean {
  return clinicId === demoClinicId();
}
