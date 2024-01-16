import { BigNumber, ethers } from 'ethers';

export class DecimalBigNumber {
  constructor(readonly value: BigNumber, readonly divisor: BigNumber) {
    this.value = value;
    this.divisor = divisor;
  }

  static fromBN(value: BigNumber, decimals: number): DecimalBigNumber {
    return new DecimalBigNumber(value, divisorFromDecimals(decimals));
  }

  /**
   * Extract as a BigNumber with the specified number of decimal places
   */
  toBN(decimals: number): BigNumber {
    return this.rescaledValue(divisorFromDecimals(decimals));
  }

  /**
   * Create by parsing the floating point string using ethers.utils.parseUnits
   */
  static parseUnits(value: string, totalDecimals: number): DecimalBigNumber {
    // eslint-disable-next-line prefer-const
    let [int, safeDecimals] = value.split('.');

    if (safeDecimals && safeDecimals.length > totalDecimals) {
      safeDecimals = safeDecimals.substring(0, totalDecimals);
    }

    const safeValue = safeDecimals ? `${int}.${safeDecimals}` : int;
    const bnIn = ethers.utils.parseUnits(safeValue, totalDecimals);
    return DecimalBigNumber.fromBN(bnIn, totalDecimals);
  }

  /**
   * A floating point string representation using ethers.utils.formatUnits. If
   * decimals is not specified, the full precision will used
   */
  formatUnits(decimals?: number): string {
    if (decimals == undefined) {
      decimals = this.getDecimals();
    }
    return ethers.utils.formatUnits(this.toBN(decimals), decimals);
  }

  /**
   * Returns the number of decimal places stored
   */
  getDecimals(): number {
    let decimals = 0;
    let divisor = this.divisor;
    while (divisor.gt(1)) {
      divisor = divisor.div(10);
      decimals += 1;
    }
    return decimals;
  }

  /**
   * add: to preserve precision, output will have the max divisor of the
   * two inputs
   */
  add(other: DecimalBigNumber): DecimalBigNumber {
    const divisor = maxBN(this.divisor, other.divisor);
    const value = this.rescaledValue(divisor).add(other.rescaledValue(divisor));
    return new DecimalBigNumber(value, divisor);
  }

  /**
   * sub: to preserve precision, output will have the max divisor of the
   * two inputs
   */
  sub(other: DecimalBigNumber): DecimalBigNumber {
    const divisor = maxBN(this.divisor, other.divisor);
    const value = this.rescaledValue(divisor).sub(other.rescaledValue(divisor));
    return new DecimalBigNumber(value, divisor);
  }

  /**
   * mul: to preserve precision, output will have the combined divisor of the
   * two inputs
   */
  mul(other: DecimalBigNumber): DecimalBigNumber {
    const divisor = this.divisor.mul(other.divisor);
    const value = this.value.mul(other.value);
    return new DecimalBigNumber(value, divisor);
  }

  /**
   * div: can always lose precision. Hence the caller must provide the
   * target number of decimal places.
   * Note this rounds 'half away from zero'
   */
  div(other: DecimalBigNumber, targetDecimals: number): DecimalBigNumber {
    validateInteger(targetDecimals);
    const divisor = BigNumber.from(10).pow(targetDecimals);

    const numerator = this.value.mul(other.divisor).mul(divisor);
    const denominator = other.value.mul(this.divisor);
    let truncatedResult = numerator.div(denominator);

    // The divisions truncate the results to integer parts only.
    // So in order to round, calculate the fractional remainder with:
    //    [(numerator x 10) / denominator] - [(numerator/denominator) x 10]
    const resultTimesTen = numerator.mul(10).div(denominator);
    const remainder = resultTimesTen.abs().sub(truncatedResult.abs().mul(10));

    const roundup = remainder.gte(5);
    if (roundup) {
      truncatedResult = truncatedResult.isNegative()
        ? truncatedResult.sub(1)
        : truncatedResult.add(1);
    }

    return new DecimalBigNumber(truncatedResult, divisor);
  }

  lt(other: DecimalBigNumber): boolean {
    const divisor = maxBN(this.divisor, other.divisor);
    return this.rescaledValue(divisor).lt(other.rescaledValue(divisor));
  }

  lte(other: DecimalBigNumber): boolean {
    const divisor = maxBN(this.divisor, other.divisor);
    return this.rescaledValue(divisor).lte(other.rescaledValue(divisor));
  }

  gt(other: DecimalBigNumber): boolean {
    const divisor = maxBN(this.divisor, other.divisor);
    return this.rescaledValue(divisor).gt(other.rescaledValue(divisor));
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  min(other: DecimalBigNumber): DecimalBigNumber {
    return this.lt(other) ? this : other;
  }

  // Note this rounds 'half away from zero'
  private rescaledValue(todivisor: BigNumber): BigNumber {
    let result = this.value.mul(todivisor).div(this.divisor);
    if (this.value.isZero() || this.divisor.eq(1)) {
      return result;
    }

    const roundup = this.value
      .abs()
      .mul(todivisor)
      .mod(this.divisor)
      .gte(this.divisor.div(2));
    if (roundup) {
      result = result.isNegative() ? result.sub(1) : result.add(1);
    }

    return result;
  }
}

export const DBN_ZERO = DecimalBigNumber.fromBN(BigNumber.from(0), 0);
export const DBN_ONE_HUNDRED = DecimalBigNumber.fromBN(BigNumber.from(100), 0);
export const DBN_TEN_THOUSAND = DecimalBigNumber.fromBN(
  BigNumber.from(10000),
  0
);

export function minDBN(
  v1: DecimalBigNumber,
  v2: DecimalBigNumber
): DecimalBigNumber {
  return v1.lte(v2) ? v1 : v2;
}

function divisorFromDecimals(decimals: number): BigNumber {
  validateInteger(decimals);
  return BigNumber.from(10).pow(decimals);
}

export function maxBN(v1: BigNumber, v2: BigNumber): BigNumber {
  return v1.gte(v2) ? v1 : v2;
}

function validateInteger(v: number): void {
  if (v % 1) {
    throw new RangeError(`Expected integer, found ${v}`);
  }
}
