@echo off
set DATABASE_URL=%CRM_TEST_DATABASE_URL%
node -r ts-node/register comprehensive-test.ts
pause
