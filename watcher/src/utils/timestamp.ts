export function formatIntoTimestamp(timestamp: string): string {
  if (timestamp === '') {
    return 'NULL';
  }
  // Expected input format is:2024-03-01T02:30:45.000Z
  // Convert the 'T' to a space
  let parts = timestamp.split('T');
  // Remove the trailing 'Z'
  parts[1] = parts[1].slice(0, -1);
  return parts.join(' ');
}

export function millisecondsToTimestamp(milliseconds: string): string {
  const datetime = new Date(Number(milliseconds)).toISOString();
  const timestamp = formatIntoTimestamp(datetime);
  return timestamp;
}
