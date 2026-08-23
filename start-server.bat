@echo off
echo Starting CRM System Development Server...
echo.
set PORT=3008
npm run dev -- -p %PORT%
