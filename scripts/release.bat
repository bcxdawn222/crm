@echo off
setlocal
python "%~dp0manage.py" %*
exit /b %errorlevel%
