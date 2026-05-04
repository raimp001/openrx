import { expect, test } from "@playwright/test"
import { decodeFunctionData } from "viem"
import { buildUsdcTransferCall, erc20TransferAbi, getBaseUsdcAddress, parseUsdcAmount } from "@/lib/basebuilder/usdc"
import { resolveBaseUsdcTransferStatus } from "@/lib/basebuilder/usdc.server"

test("Base USDC payment call encodes exact screening fee transfer", () => {
  const recipient = "0x09aeac8822F72AD49676c4DfA38519C98484730c"
  const call = buildUsdcTransferCall({ amount: "0.50", recipientAddress: recipient, network: "base" })
  const decoded = decodeFunctionData({ abi: erc20TransferAbi, data: call.data })

  expect(call.to.toLowerCase()).toBe(getBaseUsdcAddress("base").toLowerCase())
  expect(decoded.functionName).toBe("transfer")
  expect(decoded.args?.[0]).toBe(recipient)
  expect(decoded.args?.[1]).toBe(parseUsdcAmount("0.50"))
  expect(call.value).toBe(BigInt(0))
})

test("Base USDC verifier rejects non-transaction hashes without network calls", async () => {
  const status = await resolveBaseUsdcTransferStatus({ txHash: "not-a-hash" })

  expect(status.status).toBe("not_found")
  expect(status.message).toContain("transaction hash")
})
