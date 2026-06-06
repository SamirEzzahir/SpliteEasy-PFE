@echo off
cd /d %~dp0
call .venv\Scripts\activate
echo Starting SplitEasy Backend...
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8800
pause
