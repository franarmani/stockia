import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Middlewares
  app.use(helmet());
  
  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors({
    origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001',
    credentials: true,
  });

  const port = process.env.API_PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Server running on http://localhost:${port}`);
}
bootstrap();
