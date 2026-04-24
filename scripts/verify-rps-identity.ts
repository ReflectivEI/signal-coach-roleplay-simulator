import { verifyRpsIdentity } from "./rpsIdentity";

async function main() {
  const result = await verifyRpsIdentity();
  console.log(JSON.stringify(result, null, 2));
  if (!result.pass) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    pass: false,
    failures: [error instanceof Error ? error.message : String(error)],
  }, null, 2));
  process.exitCode = 1;
});
