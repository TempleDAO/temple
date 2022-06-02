import { BigNumber } from 'ethers';
import {
  formatUnits as ethersFormatUnits,
  parseUnits as ethersParseUnits,
} from 'ethers/lib/utils';

import { formatNumber } from 'utils/formatNumber';

const ATTO_DECIMALS = BigNumber.from(18);

// A wrapped BigNumber which handles operations on BigNumbers with a fixed number of decimal places.
// eg:
//    FixedDecimalBigNumber("5.0", decimals=18) / FixedDecimalBigNumber("2", decimals=18)
//         ==> FixedDecimalBigNumber("2.5", decimals=18)     (not 2.0 with 18 dp's)
//    FixedDecimalBigNumber("9", decimals=18) x FixedDecimalBigNumber("5", decimals=18)
//         ==> FixedDecimalBigNumber("45", decimals=18)      (not 45.0 with 36 dp's)
export class FixedDecimalBigNumber {
  private readonly _bn: BigNumber;
  private readonly _decimals: BigNumber;

  // Construct the BigNumber as-is with no scale conversion
  // eg:
  //    new FixedDecimalBigNumber(BigNumber.from("3.456"), 3)  ==> 3.456 (with max 18 decimal places)
  constructor(bn: BigNumber, decimals: BigNumber = ATTO_DECIMALS) {
    this._bn = bn;
    this._decimals = decimals;
  }

  // Parse the input and convert to the scale provided.
  // eg:
  //    FixedDecimalBigNumber.parseUnits("5.2", 18)  ==> 5.2 (with max 18 decimal places)
  static parseUnits(
    value: string,
    decimals: BigNumber = ATTO_DECIMALS
  ): FixedDecimalBigNumber {
    return new FixedDecimalBigNumber(
      ethersParseUnits(value, decimals),
      decimals
    );
  }

  // Format as a string, to full floating point precision
  // eg:
  //    const x = FixedDecimalBigNumber(BigNumber.from("5.12345"), 18)  ==> 512345e13
  //    x.formatUnits()  ==> "5.12345"
  formatUnits(): string {
    return ethersFormatUnits(this._bn, this._decimals);
  }

  // Format as a string, according to locale.
  // eg:
  //    const x = new FixedDecimalBigNumber(BigNumber.from("5.12345"), 18)  ==> 512345e13
  //    x.formatLocale()  ==> "5.1234"   (digits rounded half-up)
  //
  // Note/TODO: Since it's converting to Number first, this could introduce floating point error.
  formatLocale(): string {
    const asNumber = Number(this.formatUnits());
    return formatNumber(asNumber);
  }

  toString(): string {
    return Number(this.formatUnits()).toString();
  }

  bn(): BigNumber {
    return this._bn;
  }

  decimals(): BigNumber {
    return this._decimals;
  }

  // This and other's decimal places must match
  add(other: FixedDecimalBigNumber): FixedDecimalBigNumber {
    this.verifyMatch(other);
    const newBn = this._bn.add(other._bn);
    return new FixedDecimalBigNumber(newBn, this._decimals);
  }

  // This and other's decimal places must match
  sub(other: FixedDecimalBigNumber): FixedDecimalBigNumber {
    this.verifyMatch(other);
    const newBn = this._bn.sub(other._bn);
    return new FixedDecimalBigNumber(newBn, this._decimals);
  }

  // This and other's decimal places must match
  // The existing FDBN remains in the same number of decimal places - so note precision could
  // be lost. No rounding is applied
  //
  // eg if both in decimal places=2: 17.30 * 4.36 = 3.96  (full precision should be 3.96788...)
  div(other: FixedDecimalBigNumber): FixedDecimalBigNumber {
    this.verifyMatch(other);

    // Multiply the numerator by the scale before division, such that
    // when we divide, we end up with the correct net scale.
    // Note this loses precision.
    const newBn = this._bn
      .mul(this.decimalShift(this._decimals))
      .div(other._bn);

    return new FixedDecimalBigNumber(newBn, this._decimals);
  }

  // This and other's decimal places must match
  // The existing FDBN remains in the same number of decimal places - so note precision could
  // be lost. No rounding is applied
  //
  // eg if both in decimal places=2: 2.25 * 1.47 = 3.3  (full precision should be 3.3075)
  mul(other: FixedDecimalBigNumber): FixedDecimalBigNumber {
    this.verifyMatch(other);

    // Divide by the decimals after multiplication, such that
    // it ends up in the correct scale.
    // Note this loses precision.
    const newBn = this._bn
      .mul(other._bn)
      .div(this.decimalShift(this._decimals));

    return new FixedDecimalBigNumber(newBn, this._decimals);
  }

  lt(other: FixedDecimalBigNumber): boolean {
    this.verifyMatch(other);
    return this._bn.lt(other._bn);
  }

  lte(other: FixedDecimalBigNumber): boolean {
    this.verifyMatch(other);
    return this._bn.lte(other._bn);
  }

  gt(other: FixedDecimalBigNumber): boolean {
    this.verifyMatch(other);
    return this._bn.gt(other._bn);
  }

  isZero(): boolean {
    return this._bn.isZero();
  }

  private decimalShift(decimals: BigNumber): BigNumber {
    return BigNumber.from(10).pow(decimals);
  }

  private verifyMatch(other: FixedDecimalBigNumber) {
    if (!this._decimals.eq(other._decimals)) {
      throw new RangeError(
        "FixedDecimalBigNumber's do not have matching precision"
      );
    }
  }
}

export const FDBN_ZERO = FixedDecimalBigNumber.parseUnits('0');
export const FDBN_ONE_HUNDRED = FixedDecimalBigNumber.parseUnits('100');