import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('activities')
export class Activity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  user_id!: number;

  @Column({ nullable: true })
  device_id?: string;

  @Column({ nullable: true })
  app_name?: string;

  @Column({ type: 'text', nullable: true })
  window_title?: string;

  @Column({ nullable: true })
  url?: string;

  @Column('timestamp')
  start_time!: Date;

  @Column('timestamp')
  end_time!: Date;

  @Column({ type: 'int', default: 0 })
  duration!: number;

  @Column({ nullable: true })
  is_idle?: boolean;

  @Column({ nullable: true })
  subject_id?: number;

  @Column({ type: 'uuid', nullable: false })
  session_id!: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}