import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AppointmentsService } from './appointments.service';

@Controller('api/appointments')
@UseGuards(JwtAuthGuard)
export class ProtectedAppointmentsController {
  constructor(private appointmentsService: AppointmentsService) {}

  /**
   * GET /api/appointments
   * List all appointments for the company
   */
  @Get()
  async findAll(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('date') date?: string,
    @Query('employee_id') employee_id?: string,
  ) {
    return this.appointmentsService.findByCompany(req.user.company_id, {
      status,
      date,
      employee_id,
    });
  }

  /**
   * GET /api/appointments/:id
   * Get a single appointment
   */
  @Get(':id')
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.appointmentsService.findOneByCompany(id, req.user.company_id);
  }

  /**
   * PATCH /api/appointments/:id
   * Update appointment status or details
   */
  @Patch(':id')
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateDto: { status?: string; notes?: string },
  ) {
    return this.appointmentsService.updateAppointment(
      id,
      req.user.company_id,
      updateDto,
    );
  }

  /**
   * GET /api/appointments/stats
   * Get appointment statistics
   */
  @Get('stats')
  async getStats(@Request() req: any, @Query('month') month?: string) {
    return this.appointmentsService.getStats(req.user.company_id, month);
  }
}
