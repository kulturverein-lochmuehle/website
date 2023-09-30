export type Config = {
  auth: string;
  calendar: {
    google: string;
    ical: string;
    upcoming: string;
  };
  docs: {
    membership: string;
    protocols: string;
  };
};

let config: Config;

export const resolveConfig = async (): Promise<Config> => {
  const response = await fetch('/config.json');
  return await response.json();
};

export const getConfig = async (): Promise<Config> => {
  if (config === undefined) {
    config = await resolveConfig();
  }

  return config;
};
