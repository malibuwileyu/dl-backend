import { Router, Request, Response } from 'express';
import { getPool } from '../config/database';
import { logger } from '../config/logger';

const router = Router();

// Store alerts in memory (in production, use database)
let alerts: any[] = [];

// Get recent alerts
export function getRecentAlerts() {
  return alerts.slice(0, 50);
}

// Add alert (called internally by activity sync)
export function addAlert(alert: any) {
  const newAlert = {
    ...alert,
    id: Date.now().toString(),
    timestamp: new Date()
  };
  
  alerts.unshift(newAlert);
  
  // Keep only last 100 alerts
  if (alerts.length > 100) {
    alerts = alerts.slice(0, 100);
  }
  
  console.log(`[AlertRoutes] Alert added: ${alert.type} - ${alert.appName}`);
}

// Helper function to format duration
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
}

// Get recent alerts via API
router.get('/recent', async (req: Request, res: Response) => {
  try {
    // Fetch recent alerts from database
    const result = await getPool().query(`
      SELECT 
        a.id,
        a.alert_type as type,
        a.severity,
        a.title,
        a.description,
        a.metadata,
        a.created_at as timestamp,
        a.user_id,
        u.email,
        u.name
      FROM alerts a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.acknowledged = false
      ORDER BY a.created_at DESC
      LIMIT 20
    `);
    
    const recentAlerts = result.rows.map(alert => ({
      id: alert.id,
      type: alert.type,
      message: alert.title,
      severity: alert.severity,
      timestamp: alert.timestamp,
      studentId: alert.user_id,
      studentName: alert.name || alert.email,
      appName: alert.metadata?.app_name,
      duration: alert.metadata?.duration,
      url: alert.metadata?.url
    }));
    
    res.json(recentAlerts);
  } catch (error) {
    logger.error('Error fetching recent alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Clear all alerts
router.delete('/clear', (req: Request, res: Response) => {
  alerts = [];
  res.json({ message: 'All alerts cleared' });
});

// Serve alerts dashboard with data embedded
router.get('/dashboard', (req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Student Time Tracker - Alerts Dashboard</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 {
            color: #333;
        }
        .alert {
            background: white;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            border-left: 4px solid #ff4444;
        }
        .alert.distraction {
            border-left-color: #ff9800;
        }
        .alert.excessive_usage {
            border-left-color: #f44336;
        }
        .alert.offtask {
            border-left-color: #ff5722;
        }
        .alert-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .alert-type {
            font-weight: bold;
            text-transform: uppercase;
            font-size: 12px;
        }
        .alert-time {
            color: #666;
            font-size: 14px;
        }
        .status {
            color: #666;
            font-size: 14px;
            margin-bottom: 20px;
        }
        .no-alerts {
            text-align: center;
            color: #999;
            padding: 40px;
            background: white;
            border-radius: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Student Time Tracker - Real-Time Alerts</h1>
        <p class="status">Last updated: ${new Date().toLocaleTimeString()} <button onclick="location.reload()" style="margin-left: 10px; padding: 5px 10px; cursor: pointer;">Refresh</button></p>
        
        <h2>Recent Alerts (${alerts.length})</h2>
        <div id="alerts-container">
            ${alerts.length === 0 ? 
              '<div class="no-alerts">No alerts detected. Monitoring student activity...</div>' :
              alerts.slice(0, 50).map(alert => {
                const time = new Date(alert.timestamp).toLocaleTimeString();
                const typeLabels: Record<string, string> = {
                  distraction: 'Distracting App',
                  excessive_usage: 'Excessive Usage',
                  offtask: 'Off-Task Website'
                };

                return `
                  <div class="alert ${alert.type}">
                      <div class="alert-header">
                          <span class="alert-type">${typeLabels[alert.type] || alert.type}</span>
                          <span class="alert-time">${time}</span>
                      </div>
                      <div class="alert-content">
                          <strong>${alert.appName}</strong>
                          ${alert.duration ? ` - ${formatDuration(alert.duration)}` : ''}
                          ${alert.url ? `<br><small>${alert.url}</small>` : ''}
                      </div>
                  </div>
                `;
              }).join('')
            }
        </div>
    </div>
</body>
</html>
  `;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});


export default router;