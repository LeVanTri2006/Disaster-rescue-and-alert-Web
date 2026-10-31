import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './src/prisma/contract.d';
import contractJson from './src/prisma/contract.json';
import postgis from '@prisma/orm-extension-postgis/runtime';

const db = postgres<Contract>({
    contractJson,
    extensions: [postgis],
});

console.log(Object.keys(db));
console.log(Object.keys(db.orm.public));
