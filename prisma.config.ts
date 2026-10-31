import 'dotenv/config';
import { definePrismaConfig } from '@prisma/cli-engine';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';
import postgis from '@prisma/orm-extension-postgis/control';

export default definePrismaConfig({
  orm: ormConfig({
    contract: './src/prisma/contract.prisma',
    db: { connection: process.env['DATABASE_URL']! },
    extensions: [postgis],
  }),
  skills: {
    agents: ["claude", "cursor", "agents", "devin"],
  },
});
