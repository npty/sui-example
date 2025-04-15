import type { Environment } from "@axelar-network/axelarjs-sdk";

export const environment = (process.env.ENVIRONMENT ||
  "testnet") as Environment;
