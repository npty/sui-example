import { AbiCoder, concat, getBytes, hexlify, randomBytes } from "ethers";

/**
 * Generates the payload for a Squid EVM destination.
 * This payload includes the destination address and a random bytes32 value,
 * prefixed with a 4-byte version indicator (currently 0x00000000).
 * @param destinationAddress The EVM destination address.
 * @returns The generated payload as a Uint8Array.
 */
export function generateSquidEvmPayload(destinationAddress: string): string {
  // encode the payload for squid contract
  const squidPayload = AbiCoder.defaultAbiCoder().encode(
    ["address", "bytes32"],
    [destinationAddress, hexlify(randomBytes(32))],
  );
  const metadataVersionBytes = hexlify("0x");

  return concat([getBytes(metadataVersionBytes), getBytes(squidPayload)]);
}
