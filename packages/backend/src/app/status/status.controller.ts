import { Controller } from '../../utils/controller.utils';

export const statusController: Controller = {
  getHealth: (_, response) => {
    response.send({ status: 'ok' });
  }
};
