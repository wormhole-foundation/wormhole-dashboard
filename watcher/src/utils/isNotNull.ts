// Type guard to filter out null values
// This allows us to use the `filter` method on arrays of nullable values
// and only return non-null values
function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

export default isNotNull;
