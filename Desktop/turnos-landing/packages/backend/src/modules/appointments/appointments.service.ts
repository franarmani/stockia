import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Appointment, AppointmentStatus } from '../../entities/appointment.entity';
import { Service } from '../../entities/service.entity';
import { Company } from '../../entities/company.entity';
import { User } from '../../entities/user.entity';
import { CompanySchedule } from '../../entities/company-schedule.entity';
import { CreateAppointmentPublicDto } from './dto/create-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentsRepository: Repository<Appointment>,
    @InjectRepository(Service)
    private servicesRepository: Repository<Service>,
    @InjectRepository(Company)
    private companiesRepository: Repository<Company>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(CompanySchedule)
    private scheduleRepository: Repository<CompanySchedule>,
  ) {}

  /**
   * Get company by subdomain/slug
   */
  async getCompanyBySlug(slug: string) {
    const company = await this.companiesRepository.findOne({
      where: { subdomain: slug },
    });

    if (!company) {
      throw new NotFoundException(`Company with slug "${slug}" not found`);
    }

    return {
      id: company.id,
      name: company.name,
      subdomain: company.subdomain,
      email: company.email,
      phone: company.phone,
      address: company.address,
      city: company.city,
      timezone: company.timezone || 'America/Buenos_Aires',
    };
  }

  /**
   * Get all active services for a company
   */
  async getServicesByCompany(company_id: string) {
    const services = await this.servicesRepository.find({
      where: {
        company_id,
        is_active: true,
      },
      order: { order: 'ASC' },
    });

    return services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      duration_minutes: s.duration_minutes,
      price: s.price,
    }));
  }

  /**
   * Get all active employees for a company
   */
  async getEmployeesByCompany(company_id: string) {
    const employees = await this.usersRepository.find({
      where: {
        company_id,
        role: 'employee',
      },
      select: ['id', 'first_name', 'last_name', 'email'],
    });

    return employees.map((e) => ({
      id: e.id,
      name: `${e.first_name} ${e.last_name}`,
      email: e.email,
    }));
  }

  /**
   * Get available time slots for a specific date and employee
   */
  async getAvailableSlots(
    date: Date,
    employee_id: string,
    service_id: string,
  ) {
    // Get service duration
    const service = await this.servicesRepository.findOne({
      where: { id: service_id },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    // Get company schedule for the day
    const dayOfWeek = date.getDay();
    const schedule = await this.scheduleRepository.findOne({
      where: {
        day_of_week: dayOfWeek,
      },
    });

    if (!schedule || !schedule.is_open) {
      return []; // Closed that day
    }

    // Parse start and end times
    const [startHour, startMin] = schedule.start_time.split(':').map(Number);
    const [endHour, endMin] = schedule.end_time.split(':').map(Number);

    const dayStart = new Date(date);
    dayStart.setHours(startHour, startMin, 0, 0);

    const dayEnd = new Date(date);
    dayEnd.setHours(endHour, endMin, 0, 0);

    // Get all appointments for this employee on that day
    const appointments = await this.appointmentsRepository.find({
      where: {
        employee_id,
        start_time: Between(dayStart, dayEnd),
        status: 'confirmed',
      },
      order: { start_time: 'ASC' },
    });

    // Calculate available slots
    const slots = [];
    let current = new Date(dayStart);
    const duration = service.duration_minutes;
    const breakTime = schedule.break_time_minutes || 15;

    while (current < dayEnd) {
      const slotEnd = new Date(current);
      slotEnd.setMinutes(slotEnd.getMinutes() + duration);

      // Check if slot overlaps with existing appointments
      const isAvailable = !appointments.some((apt) => {
        return current < apt.end_time && slotEnd > apt.start_time;
      });

      if (isAvailable && slotEnd <= dayEnd) {
        slots.push({
          start: current.toISOString(),
          end: slotEnd.toISOString(),
          label: current.toLocaleTimeString('es-AR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        });
      }

      current.setMinutes(current.getMinutes() + duration + breakTime);
    }

    return slots;
  }

  /**
   * Create a new appointment
   */
  async createAppointment(
    dto: CreateAppointmentPublicDto,
  ): Promise<any> {
    // Get service details
    const service = await this.servicesRepository.findOne({
      where: { id: dto.service_id },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    // Get employee
    const employee = await this.usersRepository.findOne({
      where: { id: dto.employee_id },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // Validate slot availability
    const startTime = new Date(dto.start_time);
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + service.duration_minutes);

    const existingAppointments = await this.appointmentsRepository.find({
      where: {
        employee_id: dto.employee_id,
        start_time: startTime,
        status: AppointmentStatus.CONFIRMED,
      },
    });

    if (existingAppointments.length > 0) {
      throw new BadRequestException('Time slot is not available');
    }

    // Create appointment
    const appointment = this.appointmentsRepository.create({
      company_id: service.company_id,
      employee_id: dto.employee_id,
      client_name: dto.client_name,
      client_email: dto.client_email,
      client_phone: dto.client_phone,
      service_id: dto.service_id,
      service_name: service.name,
      service_duration: service.duration_minutes,
      service_price: service.price,
      start_time: startTime,
      end_time: endTime,
      status: AppointmentStatus.PENDING,
      notes: dto.notes,
      payment_method: dto.payment_method,
    });

    const saved = await this.appointmentsRepository.save(appointment);

    // TODO: Send confirmation email
    // TODO: Send SMS/WhatsApp notification

    return {
      id: saved.id,
      client_name: saved.client_name,
      client_email: saved.client_email,
      service_name: saved.service_name,
      start_time: saved.start_time,
      end_time: saved.end_time,
      status: saved.status,
      created_at: saved.created_at,
    };
  }

  /**
   * Get appointment by ID
   */
  async getAppointment(id: string) {
    const appointment = await this.appointmentsRepository.findOne({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    return {
      id: appointment.id,
      client_name: appointment.client_name,
      client_email: appointment.client_email,
      client_phone: appointment.client_phone,
      service_name: appointment.service_name,
      service_duration: appointment.service_duration,
      service_price: appointment.service_price,
      start_time: appointment.start_time,
      end_time: appointment.end_time,
      status: appointment.status,
      notes: appointment.notes,
    };
  }

  /**
   * Find appointments by company (for dashboard)
   */
  async findByCompany(
    company_id: string,
    filters?: { status?: string; date?: string; employee_id?: string },
  ) {
    let query = this.appointmentsRepository.createQueryBuilder('a')
      .where('a.company_id = :company_id', { company_id });

    if (filters?.status) {
      query = query.andWhere('a.status = :status', { status: filters.status });
    }

    if (filters?.date) {
      const startOfDay = new Date(filters.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(filters.date);
      endOfDay.setHours(23, 59, 59, 999);

      query = query.andWhere('a.start_time BETWEEN :start AND :end', {
        start: startOfDay,
        end: endOfDay,
      });
    }

    if (filters?.employee_id) {
      query = query.andWhere('a.employee_id = :employee_id', {
        employee_id: filters.employee_id,
      });
    }

    return query.orderBy('a.start_time', 'ASC').getMany();
  }

  /**
   * Find one appointment by company
   */
  async findOneByCompany(id: string, company_id: string) {
    const appointment = await this.appointmentsRepository.findOne({
      where: { id, company_id },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    return appointment;
  }

  /**
   * Update appointment (status, notes)
   */
  async updateAppointment(
    id: string,
    company_id: string,
    updateDto: { status?: string; notes?: string },
  ) {
    const appointment = await this.findOneByCompany(id, company_id);

    if (updateDto.status) {
      appointment.status = updateDto.status as AppointmentStatus;
    }
    if (updateDto.notes) {
      appointment.notes = updateDto.notes;
    }

    return this.appointmentsRepository.save(appointment);
  }

  /**
   * Get appointment statistics
   */
  async getStats(company_id: string, month?: string) {
    const monthDate = month ? new Date(month) : new Date();
    const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

    const total = await this.appointmentsRepository.count({
      where: {
        company_id,
        start_time: Between(startOfMonth, endOfMonth),
      },
    });

    const confirmed = await this.appointmentsRepository.count({
      where: {
        company_id,
        status: AppointmentStatus.CONFIRMED,
        start_time: Between(startOfMonth, endOfMonth),
      },
    });

    const completed = await this.appointmentsRepository.count({
      where: {
        company_id,
        status: AppointmentStatus.COMPLETED,
        start_time: Between(startOfMonth, endOfMonth),
      },
    });

    const revenue = await this.appointmentsRepository
      .createQueryBuilder('a')
      .select('SUM(a.service_price)', 'total')
      .where('a.company_id = :company_id', { company_id })
      .andWhere('a.status = :status', { status: AppointmentStatus.COMPLETED })
      .andWhere('a.start_time BETWEEN :start AND :end', {
        start: startOfMonth,
        end: endOfMonth,
      })
      .getRawOne();

    return {
      total,
      confirmed,
      completed,
      revenue: parseFloat(revenue?.total || 0),
    };
  }
}
