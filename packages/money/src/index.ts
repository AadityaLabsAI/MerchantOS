// Bigint money arithmetic. No float. No third-party.
// All operations preserve exact minor units (e.g. paise for INR).

export class CurrencyMismatchError extends Error {
  constructor(a: string, b: string) {
    super(`currency mismatch: ${a} vs ${b}`);
    this.name = 'CurrencyMismatchError';
  }
}

export class NegativeMinorError extends Error {
  constructor() { super('minor units must be non-negative'); this.name = 'NegativeMinorError'; }
}

const ZERO = 0n;
const TEN = 10n;

export class Money {
  readonly currency: string;
  readonly minor: bigint;

  private constructor(currency: string, minor: bigint) {
    this.currency = currency;
    this.minor = minor;
  }

  static fromMinor(currency: string, minor: bigint | number | string): Money {
    const n = typeof minor === 'bigint' ? minor : BigInt(minor);
    if (n < ZERO) throw new NegativeMinorError();
    if (currency.length !== 3) throw new Error(`currency must be ISO-4217 3-letter code, got "${currency}"`);
    return new Money(currency.toUpperCase(), n);
  }

  static zero(currency: string): Money { return Money.fromMinor(currency, 0); }

  plus(other: Money): Money {
    if (this.currency !== other.currency) throw new CurrencyMismatchError(this.currency, other.currency);
    return Money.fromMinor(this.currency, this.minor + other.minor);
  }

  minus(other: Money): Money {
    if (this.currency !== other.currency) throw new CurrencyMismatchError(this.currency, other.currency);
    return Money.fromMinor(this.currency, this.minor - other.minor);
  }

  times(multiplier: bigint | number): Money {
    const n = typeof multiplier === 'bigint' ? multiplier : BigInt(multiplier);
    return Money.fromMinor(this.currency, this.minor * n);
  }

  isZero(): boolean { return this.minor === ZERO; }
  isPositive(): boolean { return this.minor > ZERO; }

  toJSON(): { currency: string; minor: string } {
    return { currency: this.currency, minor: this.minor.toString() };
  }

  toString(): string { return `${this.minor.toString()} ${this.currency}`; }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.minor === other.minor;
  }
}

export function moneyFromMinor(currency: string, minor: bigint | number | string): Money {
  return Money.fromMinor(currency, minor);
}

/** Sum an array of Money; throws if any currency differs. */
export function sumMoney(items: readonly Money[], currency: string): Money {
  let total = Money.zero(currency);
  for (const m of items) total = total.plus(m);
  return total;
}
