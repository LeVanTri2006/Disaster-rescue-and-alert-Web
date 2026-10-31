import postgres from '@prisma/orm-postgres/runtime';
import postgis from '@prisma/orm-extension-postgis/runtime';
import type { Contract } from './src/prisma/contract.d';
import contractJson from './src/prisma/contract.json';

const db = postgres<Contract>({
  contractJson,
  extensions: [postgis],
  url: process.env['DATABASE_URL'],
});

console.log('transaction:', typeof db.transaction);
