export type Noop = { state: 'noop' };
export type Failure = { state: 'failure', message: string };
export type CreatedTransaction = { state: 'created-transaction', txHash: string };

export type AutotaskResult = Noop| Failure | CreatedTransaction;

export function failure(msg: string): AutotaskResult {
    return { state: 'failure', message: msg };
}

export function createdTransaction(txHash: string): AutotaskResult {
    return { state: 'created-transaction', txHash };
}

export function noop(): AutotaskResult {
    return { state: 'noop' };
}

export const isFailure = (op: AutotaskResult): op is Failure => {
    return op.state === 'failure';
}

export const isNoop = (op: AutotaskResult): op is Noop => {
    return op.state === 'noop';
}
