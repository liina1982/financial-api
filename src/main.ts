import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { useContainer } from 'class-validator';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  /* 
    Validation for the request body properties for security consern - no additional properties 
    can be aaded to the request bodies 
  */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
    }),
  );
  // Configuration to set up swagger
  const config = new DocumentBuilder()
    .setTitle('Financial API')
    .setDescription(
      'API to top-up account balance, withdraw money and transfer money from one account to another',
    )
    .setVersion('1.0')
    .addTag('API')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  await app.listen(3000);
}
bootstrap();
