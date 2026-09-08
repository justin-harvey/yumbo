/**
 * GTIN normalisation.
 *
 * Invariant (CLAUDE.md #1): GTINs are text, never numeric — leading zeros are
 * significant. Scanned UPC-A (12) / EAN-13 (13) / EAN-8 (8) are normalised to
 * GTIN-14 by left-padding with zeros so a single lookup key spans symbologies.
 *
 * NOTE: M3 will formalise this with a full unit-test table. The signature here
 * is the one M3 expects, so tests can be added without changing callers.
 */

export class InvalidGtinError extends Error {
  constructor(
    public readonly raw: string,
    public readonly reason: "non-numeric" | "bad-length" | "bad-check-digit",
  ) {
    super(`Invalid GTIN "${raw}": ${reason}`);
    this.name = "InvalidGtinError";
  }
}

/** Accepted body lengths for retail symbologies (including the check digit). */
const VALID_LENGTHS = new Set([8, 12, 13, 14]);

/**
 * Standard GS1 mod-10 check digit for a code *without* its check digit.
 * Weight the rightmost body digit by 3, then alternate 1, 3, 1, ...
 */
function computeCheckDigit(bodyDigits: string): number {
  let sum = 0;
  for (let i = 0; i < bodyDigits.length; i++) {
    const digit = bodyDigits.charCodeAt(bodyDigits.length - 1 - i) - 48;
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * Normalise a raw scanned code to a 14-character GTIN-14 string.
 * Throws {@link InvalidGtinError} on non-numeric input, an unexpected length,
 * or a check-digit mismatch.
 */
export function normaliseToGtin14(raw: string): string {
  const clean = raw.trim();
  if (!/^[0-9]+$/.test(clean)) {
    throw new InvalidGtinError(raw, "non-numeric");
  }
  if (!VALID_LENGTHS.has(clean.length)) {
    throw new InvalidGtinError(raw, "bad-length");
  }

  const body = clean.slice(0, -1);
  const check = clean.charCodeAt(clean.length - 1) - 48;
  if (computeCheckDigit(body) !== check) {
    throw new InvalidGtinError(raw, "bad-check-digit");
  }

  return clean.padStart(14, "0");
}
