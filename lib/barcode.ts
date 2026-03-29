export function parseBarcode(barcode: string) {
  const categoryCode = barcode.substring(1, 7);
  const weightRaw = barcode.substring(7, 13);
  const weight = parseInt(weightRaw) / 10000;

  return { categoryCode, weight };
}