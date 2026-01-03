import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from './company.entity';

@Entity('company_schedules')
export class CompanySchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  company_id: string;

  @ManyToOne(() => Company)
  company: Company;

  @Column('integer') // 0=Monday, 1=Tuesday, ..., 6=Sunday
  day_of_week: number;

  @Column('time')
  start_time: string; // "09:00"

  @Column('time')
  end_time: string; // "18:00"

  @Column('boolean', { default: true })
  is_open: boolean;

  @Column('integer', { default: 15 }) // break time between appointments in minutes
  break_time_minutes: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
