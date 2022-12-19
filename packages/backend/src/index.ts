import { config } from 'dotenv';
import { app } from './app';

// this file is for local development only,
// thus we're using a local .env file
config();

const port = process.env.PORT;
app
  .listen(port, () => console.log('Server started on port:', port))
  .addListener('error', error => {});
