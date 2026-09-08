type LogFields = {
  requestId?: string;
  operation: string;
  userId?: string;
  errorClass?: string;
  durationMs?: number;
  retryState?: string;
  extra?: Record<string, string | number | boolean | null>;
};

/**
 * Structured diagnostics. Never log message bodies, PINs, cookies, or tokens.
 */
export function logInfo(fields: LogFields) {
  console.info(JSON.stringify({ level: "info", ts: new Date().toISOString(), ...fields }));
}

export function logWarn(fields: LogFields) {
  console.warn(JSON.stringify({ level: "warn", ts: new Date().toISOString(), ...fields }));
}

export function logError(fields: LogFields) {
  console.error(JSON.stringify({ level: "error", ts: new Date().toISOString(), ...fields }));
}
