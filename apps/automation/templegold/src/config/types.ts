import { BigRational } from "@mountainpath9/big-rational";
import { ConfigureVariableMeta, maybe, TaskContext, VariableBase } from "@mountainpath9/overlord-core";


export class BigRationalVariable extends VariableBase<BigRational> {
  constructor(readonly params: { name: string, description: string, min?: number, max?: number, default?: number }) {
    super(params.name);
  }

  async getValue(ctx: TaskContext): Promise<BigRational | undefined> {
    const v = await ctx.config.getNumber(this.params.name);
    if (v === undefined) {
      return undefined;
    }

    const configDecimals = 15;   // When parsing numbers from config, assume at most 15 decimal places
    return BigRational.fromNumber(v, configDecimals);
  }

  metadata(): ConfigureVariableMeta {
    return {
      name: this.params.name,
      description: this.params.description,
      is_secret: false,
      vtype: { kind: 'number', value: {
          min: this.params.min == undefined ? null: this.params.min,
          max: this.params.max == undefined ? null: this.params.max,
      } },
      default_value:maybe(this.params.default)
    }
  }
}
