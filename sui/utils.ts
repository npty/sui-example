import { bcs, fromHex } from "@mysten/bcs";
import { arrayify } from "@ethersproject/bytes";
import { hex } from "../xrpl/utils";

export function convertAddress(byteString: string) {
  const payloadAsArray = Array.from(
    arrayify(byteString, { allowMissingPrefix: true }),
  );
  console.log("payloadAsArray", payloadAsArray);
  return bcs.vector(bcs.u8()).serialize(payloadAsArray);
}

export function convertAddressForXrpl(xrplAddress: string) {
  const hexString = hex(xrplAddress);
  return bcs
    .vector(bcs.u8())
    .serialize(arrayify(hexString, { allowMissingPrefix: true }));
}
