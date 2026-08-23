@echo off
set DATABASE_URL=mysql://root:REDACTED_c68d10500c05@localhost:3306/crm_system
node -r ts-node/register comprehensive-test.ts
pause
