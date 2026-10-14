// Outbound email is paused by default. Enable it explicitly when ready.
export function emailDeliveryConfigured(): boolean {
  return process.env.EMAIL_DELIVERY_ENABLED === "true" && Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function skipEmailVerification(): boolean {
  return process.env.NODE_ENV === "development" && process.env.EMAIL_VERIFICATION_REQUIRED === "false";
}
