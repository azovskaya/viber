import { Connection, PublicKey } from "@solana/web3.js";

export async function readTokenBalance(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
): Promise<number> {
  const accounts = await connection.getParsedTokenAccountsByOwner(owner, { mint });
  return accounts.value.reduce((sum, item) => {
    const amount = item.account.data.parsed.info.tokenAmount.uiAmountString as string | null;
    return sum + Number(amount ?? 0);
  }, 0);
}
