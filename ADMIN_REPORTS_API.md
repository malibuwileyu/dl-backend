# Admin Reports API Documentation

The Admin Reports API provides comprehensive analytics and insights for school administrators to monitor student computer usage and productivity.

## Base URL
```
/api/v1/admin/reports
```

## Endpoints

### 1. Summary Report
Get an overview of all students' productivity metrics.

**GET** `/summary`

Query Parameters:
- `startDate` (optional): Start date in YYYY-MM-DD format
- `endDate` (optional): End date in YYYY-MM-DD format
- Default: Last 30 days

Response:
```json
{
  "summary": {
    "totalStudents": 7,
    "activeStudents": 7,
    "avgProductivityScore": 42.99,
    "avgHoursPerStudent": 4.73,
    "avgProductiveHours": 2.45,
    "avgAcademicHours": 2.45,
    "avgActiveDays": 1.29,
    "gradeDistribution": {
      "grade9": 0,
      "grade10": 0,
      "grade11": 0,
      "grade12": 0
    },
    "highestProductivityScore": 100,
    "lowestProductivityScore": 0
  },
  "topStudents": [
    {
      "id": 5,
      "name": "Diana Wilson",
      "email": "diana.wilson@school.edu",
      "grade": 11,
      "totalHours": 4.33,
      "productiveHours": 4.33,
      "productivityScore": 100
    }
  ]
}
```

### 2. Grade Report
Get detailed statistics for a specific grade level.

**GET** `/by-grade/:grade`

Parameters:
- `grade`: Grade level (9-12)

Query Parameters:
- `startDate` (optional): Start date in YYYY-MM-DD format
- `endDate` (optional): End date in YYYY-MM-DD format

Response:
```json
{
  "grade": 10,
  "statistics": {
    "totalStudents": 25,
    "activeStudents": 23,
    "avgProductivityScore": 68.5,
    "avgTotalHours": 5.2,
    "avgProductiveHours": 3.5,
    "avgNeutralHours": 1.0,
    "avgDistractingHours": 0.7,
    "avgAcademicHours": 3.5,
    "avgActiveDays": 4.5,
    "productivityStdDev": 12.3
  },
  "students": [
    {
      "id": 123,
      "name": "John Doe",
      "email": "john.doe@school.edu",
      "totalHours": 6.5,
      "productiveHours": 5.0,
      "neutralHours": 1.0,
      "distractingHours": 0.5,
      "academicHours": 5.0,
      "activeDays": 5,
      "productivityScore": 76.9
    }
  ]
}
```

### 3. Outliers Report
Identify students with concerning usage patterns.

**GET** `/outliers`

Query Parameters:
- `threshold` (optional): Academic time percentage threshold (default: 30)
- `startDate` (optional): Start date in YYYY-MM-DD format
- `endDate` (optional): End date in YYYY-MM-DD format
- Default period: Last 7 days

Response:
```json
{
  "threshold": 30,
  "overallStats": {
    "avgAcademicPercentage": 42.99,
    "avgTotalHours": 4.73
  },
  "outliers": [
    {
      "id": 3,
      "name": "Bob Smith",
      "email": "bob.smith@school.edu",
      "grade": 10,
      "totalHours": 3.5,
      "academicHours": 0,
      "distractingHours": 0,
      "academicPercentage": 0,
      "activeDays": 1,
      "outlierType": "Low Academic Time",
      "distractingApps": []
    }
  ],
  "totalOutliers": 3
}
```

Outlier Types:
- **Low Academic Time**: Students below the academic percentage threshold
- **High Distraction**: Students with >50% time on distracting apps
- **Single Day Burst**: Students with only 1 active day but >8 hours usage

### 4. Individual Student Report
Get detailed analytics for a specific student.

**GET** `/student/:studentId`

Parameters:
- `studentId`: The student's ID

Query Parameters:
- `startDate` (optional): Start date in YYYY-MM-DD format
- `endDate` (optional): End date in YYYY-MM-DD format

Response:
```json
{
  "student": {
    "id": 1,
    "name": "Ryan Heron",
    "email": "ryan.heron@school.edu",
    "grade": 11
  },
  "statistics": {
    "totalHours": 9.91,
    "productiveHours": 9.09,
    "neutralHours": 0.60,
    "distractingHours": 0,
    "academicHours": 9.09,
    "productivityScore": 91.67,
    "academicPercentage": 91.67,
    "activeDays": 3,
    "firstActiveDate": "2025-08-17T05:00:00.000Z",
    "lastActiveDate": "2025-08-19T05:00:00.000Z"
  },
  "topApps": [
    {
      "appName": "Terminal",
      "category": "productive",
      "usageHours": 8.19
    }
  ],
  "dailyActivity": [
    {
      "date": "2025-08-19T05:00:00.000Z",
      "totalHours": 1.11,
      "productiveHours": 0.66,
      "distractingHours": 0
    }
  ]
}
```

## Key Metrics Explained

- **Productivity Score**: Percentage of time spent on productive apps vs total time
- **Academic Time**: Time spent on apps categorized as academic/productive
- **Active Days**: Number of days with recorded activity
- **Outliers**: Students whose usage patterns deviate significantly from average

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200`: Success
- `400`: Bad request (invalid parameters)
- `404`: Student not found
- `500`: Server error

Error response format:
```json
{
  "error": "Error message"
}
```

## Testing

Run the test script to verify all endpoints:
```bash
./test-admin-reports.sh
```