/* eslint-disable no-console */
export function pathToBytes(path: string): number[] {
  const parts = path.split('/');
  parts.shift(); // remove 'm'
  const bytes: number[] = [parts.length];
  parts.forEach(p => {
    const hardened = p.endsWith("'");
    const byte = parseInt(hardened ? p.substring(0, p.length - 1) : p);
    bytes.push((byte / 256) | (hardened ? 128 : 0));
    bytes.push(byte % 256);
  });
  while (bytes.length < 11) {
    bytes.push(0);
  }
  console.log('pathToBytes', path, bytes);
  return bytes;
}
