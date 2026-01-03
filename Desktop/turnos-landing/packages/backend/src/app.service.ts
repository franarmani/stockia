import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Turnos SaaS API - Active ✅';
  }
}
