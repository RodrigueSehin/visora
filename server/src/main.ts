import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config } from './config';

async function bootstrap() {
  const c = config(); // fails fast on invalid environment
  // Imported after config validation: some decorators read the configuration.
  const { AppModule, configureApp } = await import('./app.module');
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  configureApp(app);
  await app.listen(c.PORT);
  Logger.log(`API VISORA prête sur http://localhost:${c.PORT}`, 'Bootstrap');
}

bootstrap().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
