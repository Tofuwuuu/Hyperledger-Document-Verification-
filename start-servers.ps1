# Start the backend server
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

# Start the frontend server
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"

Write-Output "Both servers started! Access frontend at http://localhost:5173 and backend at http://localhost:8000" 