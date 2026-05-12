import { defineConfig } from 'prisma/config'
import 'dotenv/config'

export default defineConfig({
  earlyAccess: true,
  datasourceUrl: process.env.DATABASE_URL || 'file:./dev.db',
})
