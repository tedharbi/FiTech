import NodeCache from "node-cache";

// 8 hours = 8 * 60 * 60 = 28,800 seconds
export const cache = new NodeCache({ stdTTL: 28800 });
