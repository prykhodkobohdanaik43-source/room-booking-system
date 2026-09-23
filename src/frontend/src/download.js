// Зберігає Blob як файл у браузері (ФВ-12); окремо від сторінок, щоб їх можна було тестувати без DOM-завантажень
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
