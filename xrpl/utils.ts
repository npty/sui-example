import { xrpToDrops, type Client } from "xrpl";

export function hex(str: string): string {
  return Buffer.from(str).toString("hex");
}

export function parseToken(token: string, amount: string) {
  if (token === "XRP") {
    const drops = xrpToDrops(amount).toString();
    console.log(drops);
    return drops;
  } else {
    throw new Error("Unsupported token");
  }
}

export async function getBalance(client: Client, account: string) {
  try {
    const { result } = await client.request({
      command: "account_info",
      account,
    });

    const { Balance, Sequence } = result.account_data;

    return {
      balance: Balance,
      sequence: Sequence,
    };
  } catch (error: any) {
    if (error.data?.error === "actNotFound") {
      return {
        balance: "0",
        sequence: "-1",
      };
    }

    throw error;
  }
}
