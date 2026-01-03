import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

export enum AppointmentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  company_id: string;

  @ManyToOne(() => Company)
  company: Company;

  @Column('uuid', { nullable: true })
  employee_id: string;

  @ManyToOne(() => User, { nullable: true })
  employee: User;

  @Column('uuid', { nullable: true })
  client_id: string;

  @Column('varchar', { length: 100 })
  client_name: string;

  @Column('varchar', { length: 100 })
  client_email: string;

  @Column('varchar', { length: 20 })
  client_phone: string;

  @Column('uuid')
  service_id: string;

  @Column('varchar', { length: 200 })
  service_name: string;

  @Column('integer')
  service_duration: number; // in minutes

  @Column('decimal', { precision: 10, scale: 2 })
  service_price: number;

  @Column('timestamp')
  start_time: Date;

  @Column('timestamp')
  end_time: Date;

  @Column('enum', { enum: AppointmentStatus, default: AppointmentStatus.PENDING })
  status: AppointmentStatus;

  @Column('text', { nullable: true })
  notes: string;

  @Column('boolean', { default: false })
  paid: boolean;

  @Column('varchar', { length: 100, nullable: true })
  payment_method: string;

  @Column('varchar', { length: 100, nullable: true })
  transaction_id: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
