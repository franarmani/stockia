import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from './company.entity';

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  company_id: string;

  @ManyToOne(() => Company)
  company: Company;

  @Column('varchar', { length: 200 })
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('integer')
  duration_minutes: number; // 15, 30, 45, 60, 90, 120

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column('boolean', { default: true })
  is_active: boolean;

  @Column('integer', { default: 0 })
  order: number; // para ordenar en UI

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
