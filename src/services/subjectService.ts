import { getPool } from '../config/database';
import { logger } from '../config/logger';
import { Subject, StudentSchedule, CurrentSubjectSelection, SubjectActivity, SubjectDetectionRule, SubjectDetectionResult } from '../models/Subject';

export class SubjectService {
  // Get all subjects
  static async getAllSubjects(): Promise<Subject[]> {
    const query = 'SELECT * FROM subjects ORDER BY name';
    const result = await getPool().query(query);
    return result.rows;
  }

  // Get subject by ID
  static async getSubjectById(id: string): Promise<Subject | null> {
    const query = 'SELECT * FROM subjects WHERE id = $1';
    const result = await getPool().query(query, [id]);
    return result.rows[0] || null;
  }

  // Get student's schedule
  static async getStudentSchedule(studentId: string, dayOfWeek?: number): Promise<StudentSchedule[]> {
    // Convert studentId to integer for database
    const studentIdInt = parseInt(studentId, 10);
    if (isNaN(studentIdInt)) {
      throw new Error('Invalid student ID format');
    }
    
    let query = `
      SELECT ss.*, s.name as subject_name, s.color as subject_color
      FROM student_schedules ss
      JOIN subjects s ON ss.subject_id = s.id
      WHERE ss.student_id = $1
    `;
    const params: any[] = [studentIdInt];

    if (dayOfWeek !== undefined) {
      query += ' AND ss.day_of_week = $2';
      params.push(dayOfWeek);
    }

    query += ' ORDER BY ss.day_of_week, ss.start_time';
    const result = await getPool().query(query, params);
    return result.rows;
  }

  // Add/update student schedule
  static async upsertStudentSchedule(
    studentId: string,
    subjectId: string,
    dayOfWeek: number,
    startTime: string,
    endTime: string
  ): Promise<StudentSchedule> {
    // Convert studentId to integer for database
    const studentIdInt = parseInt(studentId, 10);
    if (isNaN(studentIdInt)) {
      throw new Error('Invalid student ID format');
    }
    
    const query = `
      INSERT INTO student_schedules (student_id, subject_id, day_of_week, start_time, end_time)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (student_id, day_of_week, start_time)
      DO UPDATE SET 
        subject_id = EXCLUDED.subject_id,
        end_time = EXCLUDED.end_time,
        updated_at = NOW()
      RETURNING *
    `;
    const subjectIdInt = parseInt(subjectId, 10);
    if (isNaN(subjectIdInt)) {
      throw new Error('Invalid subject ID format');
    }
    
    const result = await getPool().query(query, [studentIdInt, subjectIdInt, dayOfWeek, startTime, endTime]);
    return result.rows[0];
  }

  // Get current subject selection
  static async getCurrentSubject(studentId: string): Promise<CurrentSubjectSelection | null> {
    // Convert studentId to integer for database
    const studentIdInt = parseInt(studentId, 10);
    if (isNaN(studentIdInt)) {
      throw new Error('Invalid student ID format');
    }
    
    const query = `
      SELECT css.*, s.name as subject_name, s.color as subject_color
      FROM current_subject_selections css
      JOIN subjects s ON css.subject_id = s.id
      WHERE css.student_id = $1 AND css.ended_at IS NULL
      ORDER BY css.started_at DESC
      LIMIT 1
    `;
    const result = await getPool().query(query, [studentIdInt]);
    return result.rows[0] || null;
  }

  // Set current subject selection
  static async setCurrentSubject(
    studentId: string,
    subjectId: string,
    deviceId?: string
  ): Promise<CurrentSubjectSelection> {
    // Convert studentId to integer for database
    const studentIdInt = parseInt(studentId, 10);
    if (isNaN(studentIdInt)) {
      throw new Error('Invalid student ID format');
    }
    
    // End any existing selection
    await getPool().query(
      'UPDATE current_subject_selections SET ended_at = NOW() WHERE student_id = $1 AND ended_at IS NULL',
      [studentIdInt]
    );

    // Create new selection
    const query = `
      INSERT INTO current_subject_selections (student_id, subject_id, device_id)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const subjectIdInt = parseInt(subjectId, 10);
    if (isNaN(subjectIdInt)) {
      throw new Error('Invalid subject ID format');
    }
    
    const result = await getPool().query(query, [studentIdInt, subjectIdInt, deviceId]);
    return result.rows[0];
  }

  // End current subject selection
  static async endCurrentSubject(studentId: string): Promise<void> {
    // Convert studentId to integer for database
    const studentIdInt = parseInt(studentId, 10);
    if (isNaN(studentIdInt)) {
      throw new Error('Invalid student ID format');
    }
    
    await getPool().query(
      'UPDATE current_subject_selections SET ended_at = NOW() WHERE student_id = $1 AND ended_at IS NULL',
      [studentIdInt]
    );
  }

  // Detect subject from activity
  static async detectSubject(appName: string, url?: string, windowTitle?: string): Promise<SubjectDetectionResult | null> {
    try {
      // Check URL patterns first (highest priority)
      if (url) {
        const urlResult = await this.checkUrlPatterns(url);
        if (urlResult) return urlResult;
      }

      // Check app patterns
      const appResult = await this.checkAppPatterns(appName);
      if (appResult) return appResult;

      // Check keyword patterns in window title
      if (windowTitle) {
        const keywordResult = await this.checkKeywordPatterns(windowTitle);
        if (keywordResult) return keywordResult;
      }

      return null;
    } catch (error) {
      logger.error('Error detecting subject:', error);
      return null;
    }
  }

  private static async checkUrlPatterns(url: string): Promise<SubjectDetectionResult | null> {
    const query = `
      SELECT sdr.*, s.name as subject_name
      FROM subject_detection_rules sdr
      JOIN subjects s ON sdr.subject_id = s.id
      WHERE sdr.rule_type = 'domain' AND $1 LIKE '%' || sdr.pattern || '%'
      ORDER BY sdr.priority DESC, LENGTH(sdr.pattern) DESC
      LIMIT 1
    `;
    const result = await getPool().query(query, [url.toLowerCase()]);
    
    if (result.rows[0]) {
      const rule = result.rows[0];
      return {
        subject_id: rule.subject_id,
        subject_name: rule.subject_name,
        confidence: 0.9, // High confidence for URL matches
        matched_rule: rule
      };
    }
    return null;
  }

  private static async checkAppPatterns(appName: string): Promise<SubjectDetectionResult | null> {
    const query = `
      SELECT sdr.*, s.name as subject_name
      FROM subject_detection_rules sdr
      JOIN subjects s ON sdr.subject_id = s.id
      WHERE sdr.rule_type = 'app' AND LOWER($1) LIKE '%' || LOWER(sdr.pattern) || '%'
      ORDER BY sdr.priority DESC
      LIMIT 1
    `;
    const result = await getPool().query(query, [appName]);
    
    if (result.rows[0]) {
      const rule = result.rows[0];
      return {
        subject_id: rule.subject_id,
        subject_name: rule.subject_name,
        confidence: 0.8, // Good confidence for app matches
        matched_rule: rule
      };
    }
    return null;
  }

  private static async checkKeywordPatterns(text: string): Promise<SubjectDetectionResult | null> {
    const query = `
      SELECT sdr.*, s.name as subject_name
      FROM subject_detection_rules sdr
      JOIN subjects s ON sdr.subject_id = s.id
      WHERE sdr.rule_type = 'keyword' AND LOWER($1) LIKE '%' || LOWER(sdr.pattern) || '%'
      ORDER BY sdr.priority DESC
      LIMIT 1
    `;
    const result = await getPool().query(query, [text]);
    
    if (result.rows[0]) {
      const rule = result.rows[0];
      return {
        subject_id: rule.subject_id,
        subject_name: rule.subject_name,
        confidence: 0.6, // Lower confidence for keyword matches
        matched_rule: rule
      };
    }
    return null;
  }

  // Record subject activity
  static async recordSubjectActivity(
    studentId: string,
    subjectId: string,
    duration: number,
    startedAt: Date,
    confidence?: number,
    activitySessionId?: string
  ): Promise<SubjectActivity> {
    const query = `
      INSERT INTO subject_activities 
      (user_id, subject_id, duration, activity_date, confidence)
      VALUES ($1, $2, $3, $4::date, $5)
      ON CONFLICT (user_id, subject_id, activity_date) 
      DO UPDATE SET 
        duration = subject_activities.duration + EXCLUDED.duration,
        confidence = GREATEST(subject_activities.confidence, EXCLUDED.confidence),
        updated_at = NOW()
      RETURNING *
    `;
    // Convert IDs to integers for database
    const studentIdInt = parseInt(studentId, 10);
    if (isNaN(studentIdInt)) {
      throw new Error('Invalid student ID format');
    }
    
    const subjectIdInt = parseInt(subjectId, 10);
    if (isNaN(subjectIdInt)) {
      throw new Error('Invalid subject ID format');
    }
    
    const result = await getPool().query(query, [
      studentIdInt,
      subjectIdInt,
      duration,
      startedAt,
      confidence || 0
    ]);
    return result.rows[0];
  }

  // Get subject activity summary
  static async getSubjectActivitySummary(
    studentId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    // Convert studentId to integer for database
    const studentIdInt = parseInt(studentId, 10);
    if (isNaN(studentIdInt)) {
      throw new Error('Invalid student ID format');
    }
    
    const query = `
      SELECT 
        s.id,
        s.name,
        s.color,
        SUM(sa.duration) as total_duration,
        COUNT(sa.id) as activity_count,
        AVG(sa.confidence) as avg_confidence
      FROM subject_activities sa
      JOIN subjects s ON sa.subject_id = s.id
      WHERE sa.user_id = $1 
        AND sa.activity_date >= $2 
        AND sa.activity_date <= $3
      GROUP BY s.id, s.name, s.color
      ORDER BY total_duration DESC
    `;
    const result = await getPool().query(query, [studentIdInt, startDate, endDate]);
    return result.rows;
  }

  // Check if student is on correct subject
  static async checkSubjectCompliance(
    studentId: string,
    detectedSubjectId: string
  ): Promise<{ compliant: boolean; expectedSubject?: Subject; currentSelection?: CurrentSubjectSelection }> {
    // Check current subject selection
    const currentSelection = await this.getCurrentSubject(studentId);
    if (currentSelection) {
      return {
        compliant: currentSelection.subject_id === detectedSubjectId,
        currentSelection
      };
    }

    // Check schedule
    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentTime = now.toTimeString().slice(0, 8); // HH:MM:SS

    const query = `
      SELECT ss.*, s.*
      FROM student_schedules ss
      JOIN subjects s ON ss.subject_id = s.id
      WHERE ss.student_id = $1 
        AND ss.day_of_week = $2
        AND ss.start_time <= $3
        AND ss.end_time > $3
      LIMIT 1
    `;
    // Convert studentId to integer for database
    const studentIdInt = parseInt(studentId, 10);
    if (isNaN(studentIdInt)) {
      throw new Error('Invalid student ID format');
    }
    
    const result = await getPool().query(query, [studentIdInt, dayOfWeek, currentTime]);
    
    if (result.rows[0]) {
      const expectedSubject = result.rows[0];
      return {
        compliant: expectedSubject.subject_id === detectedSubjectId,
        expectedSubject
      };
    }

    // No schedule or selection - consider compliant
    return { compliant: true };
  }

  // Add detection rule
  static async addDetectionRule(
    subjectId: string,
    ruleType: 'domain' | 'keyword' | 'app',
    pattern: string,
    priority: number = 0
  ): Promise<SubjectDetectionRule> {
    const query = `
      INSERT INTO subject_detection_rules (subject_id, rule_type, pattern, priority)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await getPool().query(query, [subjectId, ruleType, pattern, priority]);
    return result.rows[0];
  }
}