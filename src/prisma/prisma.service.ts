import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract.d';
import contractJson from './contract.json';

import postgis from '@prisma/orm-extension-postgis/runtime';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  public readonly db = postgres<Contract>({
    contractJson,
    extensions: [postgis],
    url: process.env['DATABASE_URL'],
  });

  async onModuleInit() {
    // Optionally trigger a connection check
    // In Prisma 8, the factory is lazy.
  }

  async onModuleDestroy() {
    await this.db.close();
  }
}
