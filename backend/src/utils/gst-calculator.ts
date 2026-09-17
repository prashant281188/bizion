/**
 * GST Calculation Utility for Indian Goods and Services Tax.
 *
 * GST has two components based on the supply type:
 * - Intra-state (within same state): CGST (Central) + SGST (State), each at half the GST rate
 * - Inter-state (across states): IGST (Integrated) at the full GST rate
 *
 * Place of Supply determines whether a transaction is intra-state or inter-state.
 * The supplier's state code is compared to the place of supply state code.
 */

export interface GstBreakdown {
  /** Taxable value before tax */
  taxableValue: number;
  /** Whether this is an inter-state supply */
  isInterState: boolean;
  /** Total GST rate applied (e.g., 18) */
  gstRate: number;
  /** CGST rate (half of GST rate for intra-state, 0 for inter-state) */
  cgstRate: number;
  /** CGST amount */
  cgstAmount: number;
  /** SGST rate (half of GST rate for intra-state, 0 for inter-state) */
  sgstRate: number;
  /** SGST amount */
  sgstAmount: number;
  /** IGST rate (full GST rate for inter-state, 0 for intra-state) */
  igstRate: number;
  /** IGST amount */
  igstAmount: number;
  /** Cess rate if applicable */
  cessRate: number;
  /** Cess amount */
  cessAmount: number;
  /** Total tax amount (CGST + SGST + IGST + Cess) */
  totalTax: number;
  /** Total amount including tax */
  totalAmount: number;
}

/**
 * Round a monetary value to 2 decimal places using banker's rounding.
 */
function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Determine if the supply is inter-state by comparing supplier and buyer state codes.
 * If either code is missing, defaults to intra-state.
 *
 * @param supplierStateCode - 2-digit state code of the supplier
 * @param placeOfSupplyCode - 2-digit state code of the place of supply (buyer's state)
 */
export function isInterStateSupply(
  supplierStateCode: string,
  placeOfSupplyCode: string
): boolean {
  if (!supplierStateCode || !placeOfSupplyCode) {
    return false;
  }
  return supplierStateCode !== placeOfSupplyCode;
}

/**
 * Calculate complete GST breakdown for a given taxable value.
 *
 * @param taxableValue - The base amount to calculate tax on
 * @param gstRate - The total GST rate (e.g., 5, 12, 18, 28)
 * @param supplierStateCode - Supplier's state code
 * @param placeOfSupplyCode - Buyer's / place of supply state code
 * @param cessRate - Optional cess rate (default 0)
 */
export function calculateGst(
  taxableValue: number,
  gstRate: number,
  supplierStateCode: string,
  placeOfSupplyCode: string,
  cessRate = 0,
  forceInterState?: boolean
): GstBreakdown {
  const interState = forceInterState !== undefined ? forceInterState : isInterStateSupply(supplierStateCode, placeOfSupplyCode);

  let cgstRate = 0;
  let cgstAmount = 0;
  let sgstRate = 0;
  let sgstAmount = 0;
  let igstRate = 0;
  let igstAmount = 0;

  if (interState) {
    // Inter-state: full rate as IGST
    igstRate = gstRate;
    igstAmount = roundToTwo((taxableValue * igstRate) / 100);
  } else {
    // Intra-state: split equally between CGST and SGST
    cgstRate = roundToTwo(gstRate / 2);
    sgstRate = roundToTwo(gstRate / 2);
    cgstAmount = roundToTwo((taxableValue * cgstRate) / 100);
    sgstAmount = roundToTwo((taxableValue * sgstRate) / 100);
  }

  const cessAmount = cessRate > 0 ? roundToTwo((taxableValue * cessRate) / 100) : 0;
  const totalTax = roundToTwo(cgstAmount + sgstAmount + igstAmount + cessAmount);
  const totalAmount = roundToTwo(taxableValue + totalTax);

  return {
    taxableValue: roundToTwo(taxableValue),
    isInterState: interState,
    gstRate,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate,
    igstAmount,
    cessRate,
    cessAmount,
    totalTax,
    totalAmount,
  };
}

/**
 * Calculate GST for a line item with discount applied.
 *
 * @param unitPrice - Price per unit
 * @param quantity - Number of units
 * @param discountAmount - Total discount applied on this line item
 * @param gstRate - GST rate percentage
 * @param supplierStateCode - Supplier's state code
 * @param placeOfSupplyCode - Place of supply state code
 * @param cessRate - Optional cess rate
 */
export function calculateLineItemGst(
  unitPrice: number,
  quantity: number,
  discountAmount: number,
  gstRate: number,
  supplierStateCode: string,
  placeOfSupplyCode: string,
  cessRate = 0,
  forceInterState?: boolean
): GstBreakdown {
  const lineTotal = roundToTwo(unitPrice * quantity);
  const taxableValue = roundToTwo(lineTotal - discountAmount);

  return calculateGst(taxableValue, gstRate, supplierStateCode, placeOfSupplyCode, cessRate, forceInterState);
}
