import postgres from '@prisma/orm-postgres/runtime';
import contractJson from './src/prisma/contract.json';
import postgis from '@prisma/orm-extension-postgis/runtime';
import * as dotenv from 'dotenv';
import { SosService } from './src/sos/sos.service';

dotenv.config();

const db = postgres<any>({
  contractJson,
  extensions: [postgis],
  url: process.env['DATABASE_URL'],
});

async function main() {
    const sosService = new SosService({ db } as any);
    const event = await sosService.findOne("d43861c2-9813-4db7-adfd-196a9407872c", "", "RESCUER" as any, true); // from my previous test run
    console.log(JSON.stringify(event, null, 2));
}

main().catch(console.error).finally(() => db.close());
