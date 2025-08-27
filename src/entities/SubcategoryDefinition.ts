import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { CategoryType, SubcategoryType } from './AppCategory';

@Entity('subcategory_definitions')
export class SubcategoryDefinition {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  @Index()
  name!: SubcategoryType;

  @Column()
  parent_category!: CategoryType;

  @Column()
  display_name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ nullable: true })
  color_hex?: string;

  @Column({ nullable: true })
  icon_name?: string;

  @Column({ default: 0 })
  sort_order!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}