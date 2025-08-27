#!/bin/bash

echo "=== Testing StudentTimeTracker Demo Flow ==="
echo

# Test 1: Productivity Analysis - All Students
echo "1. Testing Productivity Analysis - All Students"
curl -s "http://localhost:4051/api/v1/admin/productivity-analysis?period=today&group=all" | jq '{
  total_students: .summary.studentCount,
  productivity_score: (.summary.productiveTime / .summary.totalTime * 100 | round),
  academic_vs_non: {
    academic: (.summary.academicTime / 3600 | round),
    non_academic: (.summary.nonAcademicTime / 3600 | round)
  }
}'
echo

# Test 2: Grade-based filtering
echo "2. Testing Grade-based Filtering"
for grade in 9 10 11 12; do
  echo "Grade $grade:"
  curl -s "http://localhost:4051/api/v1/admin/productivity-analysis?period=today&group=grade-$grade" | jq '{
    students: .summary.studentCount,
    productivity: (.summary.productiveTime / .summary.totalTime * 100 | if . > 0 then round else 0 end)
  }'
done
echo

# Test 3: Find outliers (students with < 30% productivity)
echo "3. Finding Outlier Students (< 30% productivity)"
curl -s "http://localhost:4051/api/v1/admin/productivity-analysis?period=today&group=all" | jq '.students[] | 
  select((.productiveTime / .totalTime * 100) < 30) | 
  {
    name: .name,
    grade: .grade,
    productivity: (.productiveTime / .totalTime * 100 | round),
    total_hours: (.totalTime / 3600 | round)
  }'
echo

# Test 4: Check WebSocket connection
echo "4. Testing Admin Dashboard Access"
curl -s -o /dev/null -w "Admin Dashboard: %{http_code}\n" http://localhost:4051/admin-dashboard.html
curl -s -o /dev/null -w "Productivity Analysis Page: %{http_code}\n" http://localhost:4051/productivity-analysis.html
echo

echo "=== Demo Flow Test Complete ==="