export interface Subject {
  id: string;
  name: string;
  color?: string;
  description?: string;
  created_at: Date;
}

export interface StudentSchedule {
  id: string;
  student_id: string;
  subject_id: string;
  day_of_week: number; // 0-6, 0 = Sunday
  start_time: string; // HH:MM:SS format
  end_time: string; // HH:MM:SS format
  created_at: Date;
  updated_at: Date;
}

export interface CurrentSubjectSelection {
  id: string;
  student_id: string;
  subject_id: string;
  started_at: Date;
  ended_at?: Date;
  device_id?: string;
  // Additional fields from joins
  subject_name?: string;
  subject_color?: string;
}

export interface SubjectActivity {
  id: string;
  student_id: string;
  subject_id: string;
  activity_session_id?: string;
  detected_confidence?: number;
  duration: number; // seconds
  started_at: Date;
  ended_at?: Date;
  created_at: Date;
}

export interface SubjectDetectionRule {
  id: string;
  subject_id: string;
  rule_type: 'domain' | 'keyword' | 'app';
  pattern: string;
  priority: number;
  created_at: Date;
}

export interface SubjectDetectionResult {
  subject_id: string;
  subject_name: string;
  confidence: number;
  matched_rule?: SubjectDetectionRule;
}