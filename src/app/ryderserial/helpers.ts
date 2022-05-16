/**
 * Utility for enforcing exhaustiveness checks in the type system.
 *
 * @see [TypeScript Deep Dive | Discriminated Unions: Exhaustive Checks](https://basarat.gitbook.io/typescript/type-system/discriminated-unions#throw-in-exhaustive-checks)
 *
 * @param _x The variable with no remaining values
 */
export function assertNever(_x: never): never {
    throw new Error("Unexpected value. Should have been never.");
}
