/**
 * Pantry data types for RFC-003.
 *
 * PantryItem — a stored ingredient with purchase info in the user's pantry.
 * UserDefaults — global defaults for labor/overhead (pre-fill wizard Step 3).
 */

/** A single pantry ingredient with purchase pricing info. */
export interface PantryItem {
  /** Unique identifier (crypto.randomUUID()) */
  id: string;
  /** Human-readable name — must be unique across the pantry */
  name: string;
  /** Stable semantic key matching common-ingredients.ts id (e.g. "all-purpose-flour") */
  ingredientKey: string;
  /** Unit of purchase (e.g. "lb") */
  purchaseUnit: string;
  /** Amount purchased (e.g. 5 for "5 lb bag") */
  purchaseAmount: number;
  /** Price paid for the purchase amount */
  purchasePrice: number;
  /** ISO-8601 timestamp of last update */
  updatedAt: string;
}

/** Global defaults for labor & overhead, pre-filled into new recipes. */
export interface UserDefaults {
  /** Default hourly rate ($/hr) */
  hourlyRate: number;
  /** Default packaging cost per batch ($) */
  packaging: number;
  /** Default overhead cost per batch ($) */
  overhead: number;
  /** Default platform fees per batch ($) */
  platformFees: number;
}
