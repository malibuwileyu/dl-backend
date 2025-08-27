# Demo Quick Reference Card

## URLs
- Admin Dashboard: http://localhost:4051/productivity-analysis.html
- API Base: http://localhost:4051/api/v1

## Key Demo Actions

### 1. Show Real-Time Update
```bash
# On student computer
1. Open Terminal (productive)
2. Wait 5 seconds
3. Switch to Safari (neutral)
4. Check dashboard updates
```

### 2. Search for Student
```
Search box → Type "Ryan" → Show details
```

### 3. Show Reports
```bash
# Summary
curl -s "http://localhost:4051/api/v1/admin/reports/summary" | jq '.summary'

# Outliers
curl -s "http://localhost:4051/api/v1/admin/reports/outliers" | jq '.outliers[0]'

# Individual
curl -s "http://localhost:4051/api/v1/admin/reports/student/1" | jq '.'
```

### 4. Export Data
```
Click "Export CSV" → Open downloaded file
```

## Key Numbers
- **7** total students
- **43%** average productivity 
- **91.7%** Ryan's productivity
- **4** students flagged as outliers
- **<5 sec** real-time update delay

## Troubleshooting Commands
```bash
# Check if backend is running
ps aux | grep node | grep 4051

# Check if StudentTimeTracker is running
ps aux | grep StudentTimeTracker

# Restart backend if needed
cd backend && npm run dev

# Check database has data
psql student_tracker -c "SELECT COUNT(*) FROM users WHERE role='student';"
```

## Important Features to Highlight
✅ Real-time monitoring
✅ No screenshots/keylogging  
✅ Grade-based filtering
✅ Individual student search
✅ CSV export
✅ Outlier detection
✅ Last 24 hours view
✅ Academic vs non-academic split

## If Demo Fails
1. Show screenshots from `/demo-screenshots/`
2. Show pre-recorded video
3. Walk through API responses manually