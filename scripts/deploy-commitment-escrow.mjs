import { readFile } from "node:fs/promises"
import { CdpClient } from "@coinbase/cdp-sdk"
import { encodeDeployData, getAddress, isAddress } from "viem"

const REQUIRED_NETWORK = "base-sepolia"
const EXPECTED_CHAIN_ID = 84_532

function required(name) {
  const value = (process.env[name] || "").trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function address(name) {
  const value = required(name)
  if (!isAddress(value)) throw new Error(`${name} must be a valid EVM address.`)
  return getAddress(value)
}

if (process.env.OPENRX_COMMITMENT_NETWORK !== REQUIRED_NETWORK) {
  throw new Error("Refusing deployment: OPENRX_COMMITMENT_NETWORK must be base-sepolia.")
}
if (process.env.VERCEL_ENV === "production") {
  throw new Error("Refusing deployment from a production environment.")
}

const artifactPath = new URL(
  "../contracts/out/ConditionalDepositEscrow.sol/ConditionalDepositEscrow.json",
  import.meta.url,
)
const artifact = JSON.parse(await readFile(artifactPath, "utf8"))
const bytecode = artifact.bytecode?.object
if (!bytecode || !bytecode.startsWith("0x")) {
  throw new Error("Compile the contract with `npm run test:contracts` before deployment.")
}

const token = address("COMMITMENT_BASE_SEPOLIA_USDC_ADDRESS")
const adminMultisig = address("COMMITMENT_ADMIN_MULTISIG_ADDRESS")
const verifier = address("COMMITMENT_VERIFIER_ADDRESS")
const feeRecipient = address("COMMITMENT_FEE_RECIPIENT_ADDRESS")
const deployerAccountName = required("COMMITMENT_CDP_DEPLOYER_ACCOUNT_NAME")

const cdp = new CdpClient()
const deployer = await cdp.evm.getAccount({ name: deployerAccountName })
if (!deployer.policies?.length) {
  throw new Error("The CDP deployer account must have an explicit Base Sepolia deployment policy.")
}
if (deployer.address.toLowerCase() === adminMultisig.toLowerCase()) {
  throw new Error("The deployer may not be the contract administrator; use an approved multisig.")
}

const data = encodeDeployData({
  abi: artifact.abi,
  bytecode,
  args: [
    token,
    adminMultisig,
    verifier,
    feeRecipient,
    BigInt(20_000_000),
    BigInt(2_000_000),
    BigInt(0),
    BigInt(90 * 24 * 60 * 60),
    BigInt(90 * 24 * 60 * 60),
  ],
})

const scoped = await deployer.useNetwork(REQUIRED_NETWORK)
if (EXPECTED_CHAIN_ID !== 84_532) throw new Error("Unexpected Base Sepolia chain ID.")
const transaction = await scoped.sendTransaction({
  transaction: { data },
  idempotencyKey: required("COMMITMENT_DEPLOYMENT_IDEMPOTENCY_KEY"),
})
const receipt = await scoped.waitForTransactionReceipt(transaction)
if (receipt.status !== "success" || !receipt.contractAddress) {
  throw new Error("Base Sepolia escrow deployment failed.")
}

process.stdout.write(
  `${JSON.stringify(
    {
      network: REQUIRED_NETWORK,
      chainId: EXPECTED_CHAIN_ID,
      contractAddress: receipt.contractAddress,
      transactionHash: transaction.transactionHash,
      adminMultisig,
      verifier,
    },
    null,
    2,
  )}\n`,
)
