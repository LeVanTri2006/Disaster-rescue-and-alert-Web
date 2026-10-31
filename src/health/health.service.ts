import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Client } from 'pg';

@Injectable()
export class HealthService implements OnModuleInit, OnModuleDestroy {
  private client: Client;

  constructor() {
    this.client = new Client({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/canh_bao_thien_tai?schema=public',
    });
  }

  async onModuleInit() {
    try {
      await this.client.connect();
    } catch (e) {
      console.error('Failed to connect to database on init', e);
    }
  }

  async onModuleDestroy() {
    await this.client.end();
  }

  async checkHealth() {
    let databaseStatus = 'disconnected';
    let postgisStatus = 'disconnected';

    try {
      // Execute a simple query to ensure the DB connection is alive
      await this.client.query('SELECT 1');
      databaseStatus = 'connected';

      // Check PostGIS
      const result = await this.client.query('SELECT PostGIS_Version();');
      if (result && result.rows.length > 0 && result.rows[0].postgis_version) {
        postgisStatus = 'connected';
      }
    } catch (error) {
      console.error('Health check failed:', error);
    }

    return {
      status: databaseStatus === 'connected' && postgisStatus === 'connected' ? 'ok' : 'error',
      database: databaseStatus,
      postgis: postgisStatus,
    };
  }
}

