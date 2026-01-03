import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';

@Entity('companies')
export class Company {
  @PrimaryColumn('uuid')
  id: string;

  @Column('varchar', { length: 255 })
  name: string;

  @Column('varchar', { length: 100, unique: true })
  subdomain: string;

  @Column('varchar', { length: 100, unique: true })
  slug: string;

  @Column('text', { nullable: true })
  logo_url: string;

  @Column('text', { nullable: true })
  address: string;

  @Column('varchar', { length: 20, nullable: true })
  phone: string;

  @Column('varchar', { length: 255, unique: true, nullable: true })
  email: string;

  @Column('varchar', { length: 50, nullable: true })
  category: string;

  // Subscription
  @Column('varchar', { length: 50, default: 'free' })
  subscription_plan: string;

  @Column('varchar', { length: 50, default: 'trial' })
  subscription_status: string;

  @Column('timestamp', { nullable: true })
  trial_ends_at: Date;

  // Metadata
  @Column('boolean', { default: true })
  is_active: boolean;

  @Column('jsonb', { default: '{}' })
  settings: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @OneToMany(() => User, (user) => user.company)
  users: User[];
}
