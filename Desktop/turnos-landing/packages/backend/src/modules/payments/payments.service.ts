import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from '../../entities/payment.entity';
import { Appointment } from '../../entities/appointment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';

/**
 * MercadoPago Payment Service
 * Este servicio está listo para integrar MercadoPago SDK
 * 
 * Para activar:
 * 1. npm install @mercadopago/sdk-nodejs
 * 2. Agregá MERCADOPAGO_ACCESS_TOKEN a .env
 * 3. Descomentar código abajo y completar implementación
 */
@Injectable()
export class PaymentsService {
  // private client: any; // MercadoPago SDK client

  constructor(
    private configService: ConfigService,
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    @InjectRepository(Appointment)
    private appointmentsRepository: Repository<Appointment>,
  ) {
    // TODO: Implementar MercadoPago SDK
    // const { MercadoPagoConfig, Preference } = require('@mercadopago/sdk-nodejs');
    // this.client = new MercadoPagoConfig({
    //   accessToken: this.configService.get('MERCADOPAGO_ACCESS_TOKEN'),
    //   options: { timeout: 20000 },
    // });
  }

  /**
   * Crear un pago (genera link de checkout)
   */
  async createPayment(company_id: string, createPaymentDto: CreatePaymentDto) {
    // Verificar que el turno existe
    const appointment = await this.appointmentsRepository.findOne({
      where: { id: createPaymentDto.appointment_id, company_id },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    // Crear registro de pago en DB
    const payment = this.paymentsRepository.create({
      company_id,
      appointment_id: createPaymentDto.appointment_id,
      amount: createPaymentDto.amount,
      currency: createPaymentDto.currency,
      payer_email: createPaymentDto.payer_email,
      payer_name: createPaymentDto.payer_name,
      payer_phone: createPaymentDto.payer_phone,
      description: createPaymentDto.description,
      payment_method: createPaymentDto.payment_method,
      status: PaymentStatus.PENDING,
    });

    const savedPayment = await this.paymentsRepository.save(payment);

    // TODO: Integrar con MercadoPago
    // const preference = new Preference(this.client);
    // const result = await preference.create({
    //   body: {
    //     items: [
    //       {
    //         id: appointment.id,
    //         title: appointment.service_name,
    //         description: `Turno con ${appointment.employee_id}`,
    //         picture_url: 'https://tuturno.app/logo.png',
    //         category_id: 'service',
    //         quantity: 1,
    //         currency_id: createPaymentDto.currency,
    //         unit_price: createPaymentDto.amount,
    //       },
    //     ],
    //     payer: {
    //       name: createPaymentDto.payer_name,
    //       email: createPaymentDto.payer_email,
    //       phone: {
    //         number: createPaymentDto.payer_phone,
    //       },
    //     },
    //     back_urls: {
    //       success: `${process.env.FRONTEND_URL}/dashboard/appointments?payment=success`,
    //       failure: `${process.env.FRONTEND_URL}/dashboard/appointments?payment=failed`,
    //       pending: `${process.env.FRONTEND_URL}/dashboard/appointments?payment=pending`,
    //     },
    //     auto_return: 'approved',
    //     notification_url: `${process.env.API_URL}/api/payments/webhook`,
    //     external_reference: savedPayment.id,
    //   },
    // });
    //
    // savedPayment.payment_link = result.body.init_point;
    // savedPayment.metadata = result.body;
    // await this.paymentsRepository.save(savedPayment);

    return {
      id: savedPayment.id,
      appointment_id: savedPayment.appointment_id,
      amount: savedPayment.amount,
      currency: savedPayment.currency,
      status: savedPayment.status,
      payment_link: savedPayment.payment_link || null,
      // payment_link: result.body.init_point, // URL para redireccionar al cliente
    };
  }

  /**
   * Obtener pago por ID
   */
  async getPayment(id: string, company_id: string) {
    const payment = await this.paymentsRepository.findOne({
      where: { id, company_id },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  /**
   * Webhook de MercadoPago (procesa IPN)
   */
  async handleMercadoPagoWebhook(data: any) {
    // TODO: Implementar validación de webhook
    if (data.type === 'payment') {
      const externalReference = data.data.id;

      const payment = await this.paymentsRepository.findOne({
        where: { id: externalReference },
      });

      if (!payment) return;

      // Actualizar estado del pago
      if (data.data.status === 'approved') {
        payment.status = PaymentStatus.APPROVED;
        payment.transaction_id = data.data.id;
      } else if (data.data.status === 'rejected') {
        payment.status = PaymentStatus.REJECTED;
      } else if (data.data.status === 'pending') {
        payment.status = PaymentStatus.PENDING;
      }

      payment.metadata = data.data;
      await this.paymentsRepository.save(payment);

      // TODO: Enviar email de confirmación si está aprobado
    }
  }

  /**
   * Obtener estadísticas de pagos
   */
  async getPaymentStats(company_id: string) {
    const total = await this.paymentsRepository.count({
      where: { company_id },
    });

    const approved = await this.paymentsRepository.count({
      where: { company_id, status: PaymentStatus.APPROVED },
    });

    const pending = await this.paymentsRepository.count({
      where: { company_id, status: PaymentStatus.PENDING },
    });

    const totalAmount = await this.paymentsRepository
      .createQueryBuilder('p')
      .select('SUM(p.amount)', 'total')
      .where('p.company_id = :company_id', { company_id })
      .andWhere('p.status = :status', { status: PaymentStatus.APPROVED })
      .getRawOne();

    return {
      total,
      approved,
      pending,
      totalAmount: parseFloat(totalAmount?.total || 0),
    };
  }

  /**
   * Refundar pago
   */
  async refundPayment(id: string, company_id: string) {
    const payment = await this.getPayment(id, company_id);

    if (payment.status !== PaymentStatus.APPROVED) {
      throw new BadRequestException('Only approved payments can be refunded');
    }

    // TODO: Llamar a API de MercadoPago para refundar
    // const refund = new Refund(this.client);
    // await refund.create({
    //   payment_id: parseInt(payment.transaction_id),
    // });

    payment.status = PaymentStatus.REFUNDED;
    return this.paymentsRepository.save(payment);
  }
}
