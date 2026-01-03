import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Company } from './company.entity';

@Entity('users')
@Index(['company_id', 'email'], { unique: true })
export class User {
  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid')
  company_id: string;

  @ManyToOne(() => Company, (company) => company.users, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column('varchar', { length: 255 })
  email: string;

  @Column('varchar', { length: 255 })
  password_hash: string;

  @Column('varchar', { length: 100, nullable: true })
  first_name: string;

  @Column('varchar', { length: 100, nullable: true })
  last_name: string;

  @Column('varchar', { length: 50, default: 'employee' })
  role: string; // admin, employee, customer_service

  @Column('jsonb', { default: '[]' })
  permissions: string[];

  @Column('boolean', { default: true })
  is_active: boolean;

  @Column('timestamp', { nullable: true })
  last_login: Date;

  @Column('boolean', { default: false })
  email_verified: boolean;

  @Column('timestamp', { nullable: true })
  email_verified_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
