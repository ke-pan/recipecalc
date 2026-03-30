/** Format a number as US currency ($X.XX). */
export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
