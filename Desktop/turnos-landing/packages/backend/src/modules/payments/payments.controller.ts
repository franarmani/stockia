import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Controller('api/payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  /**
   * POST /api/payments
   * Create a new payment (protected)
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Request() req: any,
    @Body() createPaymentDto: CreatePaymentDto,
  ) {
    return this.paymentsService.createPayment(req.user.company_id, createPaymentDto);
  }

  /**
   * GET /api/payments/:id
   * Get payment details (protected)
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getPayment(@Request() req: any, @Param('id') id: string) {
    return this.paymentsService.getPayment(id, req.user.company_id);
  }

  /**
   * GET /api/payments/stats
   * Get payment statistics (protected)
   */
  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@Request() req: any) {
    return this.paymentsService.getPaymentStats(req.user.company_id);
  }

  /**
   * POST /api/payments/webhook
   * MercadoPago IPN webhook (public)
   */
  @Post('webhook')
  @Public()
  async webhook(@Body() data: any) {
    return this.paymentsService.handleMercadoPagoWebhook(data);
  }

  /**
   * POST /api/payments/:id/refund
   * Refund a payment (protected)
   */
  @Post(':id/refund')
  @UseGuards(JwtAuthGuard)
  async refund(@Request() req: any, @Param('id') id: string) {
    return this.paymentsService.refundPayment(id, req.user.company_id);
  }
}
