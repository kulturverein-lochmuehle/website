import { PrismaClient, Role } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const member = await prisma.user.create({
    data: {
      email: 'post@davidenke.de',
      role: Role.USER,
      password: '$2a$12$HjrhFx4JUyPXQC1/MNgyleVjFsD5jZbXJHmh7IjX2O5E3OyBGg6Tu' // "start1234$"
    }
  });
  const admin = await prisma.user.create({
    data: {
      email: 'david@enke.dev',
      role: Role.ADMIN,
      password: '$2a$12$HjrhFx4JUyPXQC1/MNgyleVjFsD5jZbXJHmh7IjX2O5E3OyBGg6Tu' // "start1234$"
    }
  });
}

main().finally(async () => {
  await prisma.$disconnect();
});
