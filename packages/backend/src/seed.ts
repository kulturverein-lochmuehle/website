import { createApp } from './app';
import { dataSource } from './app/data-source';

const app = await createApp();

const userRepository = dataSource.getRepository('User');
await userRepository.save({
  firstName: 'David',
  lastName: 'Enke'
});
