@echo off
title LandAssist AI - Runner
echo =======================================================
echo          Starting LandAssist AI (Backend + Frontend)
echo =======================================================

echo Starting Flask Backend on http://127.0.0.1:5000 ...
start "LandAssist AI - Backend" cmd /k "cd backend && .\venv\Scripts\python.exe app.py"

echo Starting Vite Frontend on http://localhost:5173 ...
start "LandAssist AI - Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Both servers started!
echo Frontend: http://localhost:5173
echo Backend:  http://127.0.0.1:5000
echo.
echo Demo Accounts:
echo - Owner:    owner@landassist.local    / OwnerPass123!
echo - Reviewer: reviewer@landassist.local / ReviewerPass123!
echo - Admin:    admin@landassist.local    / AdminPass123!
echo.
pause
