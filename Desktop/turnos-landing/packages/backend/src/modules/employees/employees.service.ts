import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';

export class CreateEmployeeDto {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role?: string; // 'employee' by default
}

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  /**
   * Create a new employee for a company
   */
  async create(company_id: string, createEmployeeDto: CreateEmployeeDto) {
    const employee = this.usersRepository.create({
      company_id,
      ...createEmployeeDto,
      role: 'employee',
    });
    return this.usersRepository.save(employee);
  }

  /**
   * Get all employees for a company
   */
  async findByCompany(company_id: string) {
    return this.usersRepository.find({
      where: { company_id, role: 'employee' },
      select: ['id', 'first_name', 'last_name', 'email', 'phone', 'created_at'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Get a single employee
   */
  async findOne(id: string, company_id: string) {
    const employee = await this.usersRepository.findOne({
      where: { id, company_id, role: 'employee' },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return employee;
  }

  /**
   * Update an employee
   */
  async update(
    id: string,
    company_id: string,
    updateEmployeeDto: Partial<CreateEmployeeDto>,
  ) {
    const employee = await this.findOne(id, company_id);

    Object.assign(employee, updateEmployeeDto);
    return this.usersRepository.save(employee);
  }

  /**
   * Delete an employee
   */
  async remove(id: string, company_id: string) {
    const employee = await this.findOne(id, company_id);
    return this.usersRepository.remove(employee);
  }

  /**
   * Get employee stats
   */
  async getStats(company_id: string) {
    const total = await this.usersRepository.count({
      where: { company_id, role: 'employee' },
    });

    return { total };
  }
}
