import { defineController } from '../../utils/controller.utils';
import { prisma } from '../index';

export const userController = defineController({
  async getAll(_, response) {
    const users = await prisma.user.findMany();
    response.json(users);
  }
});
