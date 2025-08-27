import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  email!: string;

  @Column({ nullable: true })
  name?: string;

  @Column({ select: false, nullable: true })
  password?: string;

  @Column({ type: 'varchar', length: 50 })
  role!: string; // 'student', 'teacher', 'admin'

  @Column({ nullable: true })
  organization_id?: number;

  @Column({ nullable: true })
  google_id?: string;

  @Column({ nullable: true })
  grade?: number;

  @Column({ type: 'simple-json', nullable: true })
  preferences?: any;

  @Column({ default: true })
  is_active!: boolean;

  @Column({ nullable: true })
  last_login?: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}