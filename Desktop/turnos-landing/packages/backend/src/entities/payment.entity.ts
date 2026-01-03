import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Appointment } from './appointment.entity';
import { Company } from './company.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REFUNDED = 'refunded',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  company_id: string;

  @ManyToOne(() => Company)
  company: Company;

  @Column('uuid')
  appointment_id: string;

  @ManyToOne(() => Appointment)
  appointment: Appointment;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column('varchar', { length: 10 })
  currency: string; // ARS, BRL, CLP

  @Column('varchar', { length: 100 })
  payer_email: string;

  @Column('varchar', { length: 100 })
  payer_name: string;

  @Column('varchar', { length: 20 })
  payer_phone: string;

  @Column('text')
  description: string;

  @Column('varchar', { length: 50 })
  payment_method: string;

  @Column('enum', { enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column('varchar', { length: 100, nullable: true })
  transaction_id: string; // MercadoPago payment ID

  @Column('varchar', { length: 255, nullable: true })
  payment_link: string; // MercadoPago checkout link

  @Column('json', { nullable: true })
  metadata: any; // MercadoPago response data

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
