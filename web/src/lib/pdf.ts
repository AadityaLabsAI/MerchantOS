// PDF bill generator - pure browser, no external libs
import { formatCurrency } from './i18n';

interface BillItem { name: string; qty: number; price: number; total: number; hsn?: string; }
interface BillForPdf {
  id: string;
  shop: { name: string; address?: string; phone?: string; gst?: string; upiId?: string; };
  customer: { name: string; phone?: string; gst?: string };
  items: BillItem[];
  subtotal: number; discount?: number; tax?: number;
  total: number; paid: number; due: number;
  method: string; createdAt: string;
}

function escPdf(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = w;
    } else {
      current = (current + ' ' + w).trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

function buildPage(bill: BillForPdf): string {
  const pageWidth = 226;
  const margin = 8;
  let y = 0;
  const ops: string[] = [];

  function text(s: string, x: number, fontSize = 9, font = 'F1', align: 'left' | 'center' | 'right' = 'left') {
    const display = escPdf(s);
    if (align === 'center') {
      const w = display.length * fontSize * 0.5;
      x = (pageWidth - w) / 2;
    } else if (align === 'right') {
      const w = display.length * fontSize * 0.5;
      x = pageWidth - margin - w;
    }
    ops.push(`BT /${font} ${fontSize} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${display}) Tj ET`);
    y -= fontSize + 2;
  }

  function line() {
    ops.push(`${margin} ${y.toFixed(2)} m ${(pageWidth - margin).toFixed(2)} ${y.toFixed(2)} l S`);
    y -= 4;
  }

  function blank(lines = 1) { y -= lines * 11; }

  text(bill.shop.name.toUpperCase(), 0, 13, 'F2', 'center');
  y -= 1;
  if (bill.shop.address) {
    for (const l of wrapText(bill.shop.address, 38)) text(l, 0, 8, 'F1', 'center');
  }
  if (bill.shop.phone) text(`Ph: ${bill.shop.phone}`, 0, 8, 'F1', 'center');
  if (bill.shop.gst) text(`GSTIN: ${bill.shop.gst}`, 0, 8, 'F1', 'center');
  blank(0.5);
  line();
  blank(0.3);

  text(`Bill #${bill.id}`, margin, 9);
  text(new Date(bill.createdAt).toLocaleString('en-IN'), margin, 8);
  blank(0.3);

  text(`Customer: ${bill.customer.name}`, margin, 9);
  if (bill.customer.phone) text(`  ${bill.customer.phone}`, margin, 8);
  if (bill.customer.gst) text(`  GSTIN: ${bill.customer.gst}`, margin, 8);
  blank(0.3);
  line();
  blank(0.3);

  text('Item', margin, 8, 'F2');
  text('Qty', 130, 8, 'F2');
  text('Rate', 0, 8, 'F2', 'right');
  text('Total', 0, 8, 'F2', 'right');
  y -= 1;
  line();
  blank(0.2);

  for (const it of bill.items) {
    const nameLines = wrapText(it.name, 22);
    for (let i = 0; i < nameLines.length; i++) text(nameLines[i], margin, 8);
    text(String(it.qty), 130, 8);
    text(formatCurrency(it.price), 0, 8, 'F1', 'right');
    text(formatCurrency(it.total), 0, 8, 'F1', 'right');
    y -= 1;
  }
  blank(0.3);
  line();
  blank(0.3);

  text('Subtotal', margin, 9);
  text(formatCurrency(bill.subtotal), 0, 9, 'F1', 'right');
  if (bill.discount) {
    text('Discount', margin, 9);
    text(`- ${formatCurrency(bill.discount)}`, 0, 9, 'F1', 'right');
  }
  if (bill.tax) {
    text('Tax (GST)', margin, 9);
    text(formatCurrency(bill.tax), 0, 9, 'F1', 'right');
  }
  text('TOTAL', margin, 11, 'F2');
  text(formatCurrency(bill.total), 0, 11, 'F2', 'right');
  blank(0.3);
  line();
  blank(0.3);

  text(`Method: ${bill.method}`, margin, 9);
  text(`Paid: ${formatCurrency(bill.paid)}`, margin, 9);
  if (bill.due > 0) {
    text(`BALANCE DUE: ${formatCurrency(bill.due)}`, margin, 10, 'F2');
  } else {
    text('PAID IN FULL', margin, 10, 'F2');
  }
  blank(0.5);
  if (bill.shop.upiId) {
    line();
    blank(0.3);
    text('Pay via UPI:', 0, 9, 'F2', 'center');
    text(bill.shop.upiId, 0, 11, 'F2', 'center');
    text(`Amount: ${formatCurrency(bill.total)}`, 0, 10, 'F2', 'center');
  }
  blank(0.5);
  text('Thank you for your business!', 0, 9, 'F2', 'center');
  text('--- Visit Again ---', 0, 8, 'F1', 'center');

  const content = `q\n${ops.join('\n')}\nQ`;
  const pageHeight = Math.max(400, -y + 20);
  return buildPdfPage(pageWidth, pageHeight, content);
}

function buildPdfPage(width: number, height: number, content: string): string {
  const stream = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  const obj1 = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`;
  const obj2 = `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj`;
  const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj`;
  const obj4 = `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj`;
  const obj5 = `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>\nendobj`;
  const obj6 = `6 0 obj\n${stream}\nendobj`;
  const objects = [obj1, obj2, obj3, obj4, obj5, obj6];
  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets: number[] = [];
  for (const o of objects) {
    offsets.push(pdf.length);
    pdf += o + '\n';
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += off.toString().padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return pdf;
}

export function downloadBillPdf(bill: BillForPdf): void {
  const pdfText = buildPage(bill);
  const bytes = new Uint8Array(pdfText.length);
  for (let i = 0; i < pdfText.length; i++) bytes[i] = pdfText.charCodeAt(i) & 0xff;
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bill-${bill.id}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function previewBillPdf(bill: BillForPdf): void {
  const pdfText = buildPage(bill);
  const bytes = new Uint8Array(pdfText.length);
  for (let i = 0; i < pdfText.length; i++) bytes[i] = pdfText.charCodeAt(i) & 0xff;
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
