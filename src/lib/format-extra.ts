export { formatDateTime } from "./format";
import { formatBytes } from "./uploads";
export const formatBytesSafe = (n: number) => formatBytes(Number(n) || 0);
