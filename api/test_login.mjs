import { prisma } from './src/config/db.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

async function test() {
  const users = await prisma.users.findMany({ select: { id: true, username: true, name: true, role: true } });
  console.log('Users:', users);
  
  const roni = users.find(u => u.username.toLowerCase() === 'roni');
  if (roni) {
    const hash = await prisma.users.findUnique({ where: { id: roni.id }, select: { password_hash: true } });
    const isValid = await bcrypt.compare('password', hash.password_hash);
    console.log('Roni valid:', isValid);
    
    if (isValid) {
      const token = jwt.sign(
        { userId: roni.id, username: roni.username, name: roni.name, role: roni.role },
        '***REMOVED-SECRET***',
        { expiresIn: '24h' }
      );
      console.log('TOKEN:', token);
    }
  }
  
  await prisma.$disconnect();
}

test().catch(e => { console.error(e); process.exit(1); })
