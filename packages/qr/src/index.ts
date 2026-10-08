// Local QR generation. qrcode npm package is a pure-JS local generator.
import QRCode from 'qrcode';

export async function qrPng(text: string, size = 256): Promise<Buffer> {
  return QRCode.toBuffer(text, { type: 'png', width: size, margin: 1, errorCorrectionLevel: 'M' });
}

export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 });
}

export function upiString(opts: { vpa: string; payeeName: string; amountMinor: string; currency: string; txnRef: string }): string {
  // Local UPI URI. No external call. Useful for QR-based customer payment.
  // Note: customers still need a UPI app; this is just a payload.
  const amt = (Number(opts.amountMinor) / 100).toFixed(2);
  const params = new URLSearchParams({
    pa: opts.vpa,
    pn: opts.payeeName,
    am: amt,
    cu: opts.currency,
    tn: opts.txnRef,
  });
  return `upi://pay?${params.toString()}`;
}
