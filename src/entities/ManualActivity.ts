import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('manual_activities')
export class ManualActivity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  user_id!: number;

  @Column()
  activity_name!: string;

  @Column()
  activity_type!: string; // 'soccer', 'piano', 'study', 'reading', 'exercise', 'music', 'art', 'other'

  @Column('timestamp')
  start_time!: Date;

  @Column('timestamp')
  end_time!: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}