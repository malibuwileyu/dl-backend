import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('ai_categorization_suggestions')
export class AICategorizationSuggestion {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  pattern!: string; // Domain pattern

  @Column()
  suggested_category!: string; // 'productive', 'neutral', 'distracting'

  @Column({ nullable: true })
  suggested_subcategory?: string; // 'school', 'research', 'creativity', etc.

  @Column({ type: 'text', nullable: true })
  reason?: string; // AI's reasoning

  @Column({ type: 'float', nullable: true })
  confidence?: number; // AI confidence score (0-1)

  @Column({ default: 'pending' })
  status!: string; // 'pending', 'approved', 'rejected'

  @Column({ nullable: true })
  reviewed_by?: number; // User ID who reviewed

  @Column({ nullable: true })
  reviewed_at?: Date;

  @Column({ nullable: true })
  organization_id?: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}