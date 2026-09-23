// ФВ-12: мінімальний CSV-серіалізатор (RFC 4180) із захистом від формул у Excel
const FORMULA_START = /^[=+\-@]/;
const UTF8_BOM = '\uFEFF';

function escapeCell(value) {
  let text = String(value ?? '');
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// BOM потрібен, щоб Excel правильно розпізнав кирилицю
export function toCsv(rows) {
  return UTF8_BOM + rows.map((row) => row.map(escapeCell).join(',')).join('\r\n') + '\r\n';
}
