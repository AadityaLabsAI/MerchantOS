// Local QR generation. qrcode npm package is a pure-JS local generator.
import QRCode from 'qrcode';

export async function qrPng(text: string, size = 256): Promise<Buffer> {
  return QRCode.toBuffer(text, { type: 'png', width: size, margin: 1, errorCorrectionLevel: 'M' });
}

export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 });
}

/**
 * Build a local UPI intent payload. This starts a payment in the customer's UPI
 * app; it is not proof of settlement. The backend must verify settlement before
 * changing a sale/payment to a paid state.
 */
export function upiString(opts: { vpa: string; payeeName: string; amountMinor: string; currency: string; txnRef: string }): string {
  const vpa = opts.vpa.trim();
  const payeeName = opts.payeeName.trim();
  const txnRef = opts.txnRef.trim();

  // UPI Virtual Payment Addresses are usually "handle@provider". A phone number
  // alone cannot be treated as a generic VPA; configure the exact VPA shown by
  // the merchant's bank/UPI app.
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}@[A-Za-z][A-Za-z0-9.-]{0,63}$/.test(vpa)) {
    throw new Error('Invalid UPI VPA / UPI ID');
  }
  if (!payeeName || payeeName.length > 80 || /[\\u0000-\\u001f\\u007f]/.test(payeeName)) {
    throw new Error('Payee name must be 1-80 printable characters');
  }
  if (!txnRef || txnRef.length > 80 || /[\\u0000-\\u001f\\u007f]/.test(txnRef)) {
    throw new Error('Transaction reference must be 1-80 printable characters');
  }
  if (opts.currency !== 'INR') {
    throw new Error('UPI intent currently supports INR only');
  }
  if (!/^\\d+$/.test(opts.amountMinor)) {
    throw new Error('Amount must be a non-negative integer string in minor units');
  }
  const minor = BigInt(opts.amountMinor);
  if (minor <= 0n) throw new Error('Amount must be positive');

  // Never convert money to Number: very large integer minor-unit values can
  // silently lose paise through IEEE-754 rounding.
  const amt = `${minor / 100n}.${(minor % 100n).toString().padStart(2, '0')}`;
  const params = new URLSearchParams({
    pa: vpa,
    pn: payeeName,
    am: amt,
    cu: opts.currency,
    tn: txnRef,
    tr: txnRef,
  });
  return `upi://pay?${params.toString()}`;
}
