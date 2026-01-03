import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentPublicDto, AppointmentResponseDto } from './dto/create-appointment.dto';

@Controller('api/public')
@Public()
export class PublicAppointmentsController {
  constructor(private appointmentsService: AppointmentsService) {}

  /**
   * GET /api/public/companies/:slug
   * Get company info by subdomain slug
   */
  @Get('companies/:slug')
  async getCompanyBySlug(@Param('slug') slug: string) {
    return this.appointmentsService.getCompanyBySlug(slug);
  }

  /**
   * GET /api/public/services?company_id=uuid
   * List all active services for a company
   */
  @Get('services')
  async getServices(@Query('company_id') company_id: string) {
    return this.appointmentsService.getServicesByCompany(company_id);
  }

  /**
   * GET /api/public/employees?company_id=uuid
   * List all active employees for a company
   */
  @Get('employees')
  async getEmployees(@Query('company_id') company_id: string) {
    return this.appointmentsService.getEmployeesByCompany(company_id);
  }

  /**
   * GET /api/public/availability
   * Get available time slots for a date and employee
   * Query: date (YYYY-MM-DD), employee_id (uuid)
   */
  @Get('availability')
  async getAvailability(
    @Query('date') date: string,
    @Query('employee_id') employee_id: string,
    @Query('service_id') service_id: string,
  ) {
    return this.appointmentsService.getAvailableSlots(
      new Date(date),
      employee_id,
      service_id,
    );
  }

  /**
   * POST /api/public/appointments
   * Create a new appointment (public booking)
   */
  @Post('appointments')
  @HttpCode(HttpStatus.CREATED)
  async createAppointment(
    @Body() createAppointmentDto: CreateAppointmentPublicDto,
  ): Promise<AppointmentResponseDto> {
    return this.appointmentsService.createAppointment(createAppointmentDto);
  }

  /**
   * GET /api/public/appointments/:id/confirm
   * Get appointment confirmation details
   */
  @Get('appointments/:id/confirm')
  async getAppointmentConfirm(@Param('id') id: string) {
    return this.appointmentsService.getAppointment(id);
  }
}
