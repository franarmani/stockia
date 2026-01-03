import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';

@Controller('api/services')
@UseGuards(JwtAuthGuard)
export class ServicesController {
  constructor(private servicesService: ServicesService) {}

  /**
   * POST /api/services
   * Create a new service
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req: any, @Body() createServiceDto: CreateServiceDto) {
    return this.servicesService.create(req.user.company_id, createServiceDto);
  }

  /**
   * GET /api/services
   * List all services for the company
   */
  @Get()
  async findAll(@Request() req: any) {
    return this.servicesService.findByCompany(req.user.company_id);
  }

  /**
   * GET /api/services/stats
   * Get service statistics
   */
  @Get('stats')
  async getStats(@Request() req: any) {
    return this.servicesService.getStats(req.user.company_id);
  }

  /**
   * GET /api/services/:id
   * Get a single service
   */
  @Get(':id')
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.servicesService.findOne(id, req.user.company_id);
  }

  /**
   * PATCH /api/services/:id
   * Update a service
   */
  @Patch(':id')
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateServiceDto: CreateServiceDto,
  ) {
    return this.servicesService.update(id, req.user.company_id, updateServiceDto);
  }

  /**
   * DELETE /api/services/:id
   * Delete a service
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.servicesService.remove(id, req.user.company_id);
  }
}
