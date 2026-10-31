import postgres from '@prisma/orm-postgres/runtime';
import postgis from '@prisma/orm-extension-postgis/runtime';
import type { Contract } from './src/prisma/contract.d';
import contractJson from './src/prisma/contract.json';

async function main() {
  const db = postgres<Contract>({
    contractJson,
    extensions: [postgis],
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/canh_bao_thien_tai?schema=public',
  });
  const req = await db.orm.public.RescueRequest.where({ id: '317c93ce-7878-41a7-9c35-15993b44977d' }).first();
  console.log('RescueRequest:', req);
  await db.close();
}
main().catch(console.error);
