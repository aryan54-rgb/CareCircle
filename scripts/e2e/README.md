# End-to-End Live Integration Tests

> **IMPORTANT:** The scripts in this directory (`test-phase1.ts`, `test-phase2.ts`, `test-phase3.ts`, `test-phase4-7.ts`) run integration tests against the live AWS environment (API Gateway, DynamoDB, SES, Bedrock).
>
> They are **not** offline unit tests. To run them, ensure network access and AWS environment variables or live endpoints are configured as needed.

## Running Live E2E Tests

```bash
# Set custom API_URL if testing a different stage or local server:
# export API_URL="https://odu8ihixga.execute-api.ap-south-1.amazonaws.com"

npx tsx scripts/e2e/test-phase1.ts
npx tsx scripts/e2e/test-phase2.ts
npx tsx scripts/e2e/test-phase3.ts
npx tsx scripts/e2e/test-phase4-7.ts
```
