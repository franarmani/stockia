import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from '../../entities/service.entity';
import { CreateServiceDto } from './dto/create-service.dto';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private servicesRepository: Repository<Service>,
  ) {}

  /**
   * Create a new service for a company
   */
  async create(company_id: string, createServiceDto: CreateServiceDto) {
    const service = this.servicesRepository.create({
      company_id,
      ...createServiceDto,
    });
    return this.servicesRepository.save(service);
  }

  /**
   * Get all services for a company
   */
  async findByCompany(company_id: string) {
    return this.servicesRepository.find({
      where: { company_id },
      order: { order: 'ASC', created_at: 'DESC' },
    });
  }

  /**
   * Get a single service
   */
  async findOne(id: string, company_id: string) {
    const service = await this.servicesRepository.findOne({
      where: { id, company_id },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return service;
  }

  /**
   * Update a service
   */
  async update(
    id: string,
    company_id: string,
    updateServiceDto: CreateServiceDto,
  ) {
    const service = await this.findOne(id, company_id);

    Object.assign(service, updateServiceDto);
    return this.servicesRepository.save(service);
  }

  /**
   * Delete a service
   */
  async remove(id: string, company_id: string) {
    const service = await this.findOne(id, company_id);
    return this.servicesRepository.remove(service);
  }

  /**
   * Get total count and stats
   */
  async getStats(company_id: string) {
    const total = await this.servicesRepository.count({
      where: { company_id },
    });

    const active = await this.servicesRepository.count({
      where: { company_id, is_active: true },
    });

    const avgPrice = await this.servicesRepository
      .createQueryBuilder('s')
      .select('AVG(s.price)', 'avgPrice')
      .where('s.company_id = :company_id', { company_id })
      .getRawOne();

    return {
      total,
      active,
      avgPrice: parseFloat(avgPrice?.avgPrice || 0),
    };
  }
}
