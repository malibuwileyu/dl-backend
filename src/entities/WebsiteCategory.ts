import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('website_categories')
export class WebsiteCategory {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  pattern!: string; // Domain pattern to match

  @Column({ type: 'varchar', length: 50 })
  category!: string; // 'productive', 'neutral', 'distracting'

  @Column({ type: 'varchar', length: 50, nullable: true })
  subcategory?: string; // 'school', 'research', 'creativity', etc.

  @Column({ nullable: true })
  name?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ nullable: true })
  created_by?: number;

  @Column({ default: true })
  is_system!: boolean; // System-defined vs user-defined

  @Column({ default: 1 })
  priority!: number; // Higher priority patterns are checked first

  @Column({ nullable: true })
  organization_id?: number; // Org-specific rules

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}