import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type CategoryType = 'productive' | 'neutral' | 'distracting';
export type SubcategoryType = 'school' | 'research' | 'creativity' | 'productivity' | 
  'communication' | 'reading' | 'health' | 'gaming' | 'scrolling' | 'entertainment';

@Entity('app_categories')
@Index(['app_name', 'organization_id'], { unique: true })
export class AppCategory {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  @Index()
  app_name!: string;

  @Column({ nullable: true })
  bundle_id?: string;

  @Column({
    type: 'enum',
    enum: ['productive', 'neutral', 'distracting'],
    default: 'neutral',
  })
  category!: CategoryType;

  @Column({ nullable: true })
  @Index()
  subcategory?: SubcategoryType;

  @Column({ nullable: true })
  organization_id?: number;

  @Column({ default: false })
  is_global!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}