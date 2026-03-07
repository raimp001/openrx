interface LaunchBaseBuilderPayInput {
  amount: string
  recipientAddress: string
}

interface LaunchBaseBuilderPayResult {
  paymentId: string
  amount: string
  recipientAddress: string
}

function normalizeUsdcAmount(raw: string): string {
  const parsed = Number.parseFloat(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Amount must be a positive number.")
  }
  return parsed.toFixed(2)
}

function assertEvmAddress(address: string): void {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error("Recipient must be a valid EVM address.")
  }
}

export async function launchBaseBuilderPay(
  input: LaunchBaseBuilderPayInput
): Promise<LaunchBaseBuilderPayResult> {
  const amount = normalizeUsdcAmount(input.amount)
  const recipientAddress = input.recipientAddress.trim()
  assertEvmAddress(recipientAddress)

  const { pay } = await import("@base-org/account")
  const result = await pay({
    amount,
    to: recipientAddress,
  })

  return {
    paymentId: result.id,
    amount,
    recipientAddress,
  }
}
