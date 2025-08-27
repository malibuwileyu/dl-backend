#!/bin/bash

# Test Admin Reports API endpoints

BASE_URL="http://localhost:4051/api/v1/admin/reports"

echo "=== Testing Admin Reports API ==="
echo ""

# 1. Test Summary Report
echo "1. Testing Summary Report..."
echo "-------------------------"
curl -s "$BASE_URL/summary" | jq '.'
echo ""

# 2. Test Summary Report with date range
echo "2. Testing Summary Report with date range (last 7 days)..."
echo "--------------------------------------------------------"
START_DATE=$(date -v-7d +%Y-%m-%d)
END_DATE=$(date +%Y-%m-%d)
curl -s "$BASE_URL/summary?startDate=$START_DATE&endDate=$END_DATE" | jq '.'
echo ""

# 3. Test Grade 9 Report
echo "3. Testing Grade 9 Report..."
echo "--------------------------"
curl -s "$BASE_URL/by-grade/9" | jq '.'
echo ""

# 4. Test Grade 10 Report
echo "4. Testing Grade 10 Report..."
echo "---------------------------"
curl -s "$BASE_URL/by-grade/10" | jq '.'
echo ""

# 5. Test Grade 11 Report
echo "5. Testing Grade 11 Report..."
echo "---------------------------"
curl -s "$BASE_URL/by-grade/11" | jq '.'
echo ""

# 6. Test Grade 12 Report
echo "6. Testing Grade 12 Report..."
echo "---------------------------"
curl -s "$BASE_URL/by-grade/12" | jq '.'
echo ""

# 7. Test Invalid Grade (should return error)
echo "7. Testing Invalid Grade (13)..."
echo "-------------------------------"
curl -s "$BASE_URL/by-grade/13" | jq '.'
echo ""

# 8. Test Outliers Report (default threshold)
echo "8. Testing Outliers Report (default threshold)..."
echo "-----------------------------------------------"
curl -s "$BASE_URL/outliers" | jq '.'
echo ""

# 9. Test Outliers Report with custom threshold
echo "9. Testing Outliers Report (40% threshold)..."
echo "-------------------------------------------"
curl -s "$BASE_URL/outliers?threshold=40" | jq '.'
echo ""

# 10. Test Outliers Report with date range
echo "10. Testing Outliers Report with date range..."
echo "--------------------------------------------"
curl -s "$BASE_URL/outliers?startDate=$START_DATE&endDate=$END_DATE&threshold=25" | jq '.'
echo ""

# 11. Get a student ID for individual report testing
echo "11. Getting student ID for individual report..."
echo "---------------------------------------------"
STUDENT_ID=$(curl -s "$BASE_URL/summary" | jq -r '.topStudents[0].id // empty')

if [ -n "$STUDENT_ID" ]; then
    echo "Found student ID: $STUDENT_ID"
    echo ""
    
    # 12. Test Individual Student Report
    echo "12. Testing Individual Student Report..."
    echo "--------------------------------------"
    curl -s "$BASE_URL/student/$STUDENT_ID" | jq '.'
    echo ""
    
    # 13. Test Individual Student Report with date range
    echo "13. Testing Individual Student Report with date range..."
    echo "------------------------------------------------------"
    curl -s "$BASE_URL/student/$STUDENT_ID?startDate=$START_DATE&endDate=$END_DATE" | jq '.'
    echo ""
else
    echo "No student found with activity data"
fi

# 14. Test non-existent student (should return 404)
echo "14. Testing Non-existent Student..."
echo "---------------------------------"
curl -s "$BASE_URL/student/non-existent-id" | jq '.'
echo ""

echo "=== Admin Reports API Testing Complete ==="