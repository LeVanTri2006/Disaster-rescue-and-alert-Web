import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './src/prisma/contract.d';
import contractJson from './src/prisma/contract.json';
import postgis from '@prisma/orm-extension-postgis/runtime';
import * as dotenv from 'dotenv';
dotenv.config();

const db = postgres<Contract>({
    contractJson,
    extensions: [postgis],
    url: process.env.DATABASE_URL
});

async function main() {
    const res = await (db as any).sql`SELECT 1 as "num"`;
    console.log(res);
}
main().finally(() => db.close());
