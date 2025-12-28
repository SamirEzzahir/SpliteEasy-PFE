@echo off
cd /d %~dp0
call .venv\Scripts\activate
echo Starting SplitEasy Backend...
python -m uvicorn backend.main:app --reload
pause
