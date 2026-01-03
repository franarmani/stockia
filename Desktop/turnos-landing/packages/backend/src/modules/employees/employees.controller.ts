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
import { EmployeesService, CreateEmployeeDto } from './employees.service';

@Controller('api/employees')
@UseGuards(JwtAuthGuard)
export class EmployeesController {
  constructor(private employeesService: EmployeesService) {}

  /**
   * POST /api/employees
   * Create a new employee
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req: any, @Body() createEmployeeDto: CreateEmployeeDto) {
    return this.employeesService.create(req.user.company_id, createEmployeeDto);
  }

  /**
   * GET /api/employees
   * List all employees
   */
  @Get()
  async findAll(@Request() req: any) {
    return this.employeesService.findByCompany(req.user.company_id);
  }

  /**
   * GET /api/employees/stats
   * Get employee statistics
   */
  @Get('stats')
  async getStats(@Request() req: any) {
    return this.employeesService.getStats(req.user.company_id);
  }

  /**
   * GET /api/employees/:id
   * Get a single employee
   */
  @Get(':id')
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.employeesService.findOne(id, req.user.company_id);
  }

  /**
   * PATCH /api/employees/:id
   * Update an employee
   */
  @Patch(':id')
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateEmployeeDto: Partial<CreateEmployeeDto>,
  ) {
    return this.employeesService.update(id, req.user.company_id, updateEmployeeDto);
  }

  /**
   * DELETE /api/employees/:id
   * Delete an employee
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.employeesService.remove(id, req.user.company_id);
  }
}
