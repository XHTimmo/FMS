import Store from 'electron-store';

interface Config {
  dbPath?: string;
  theme?: 'light' | 'dark';
}

const store = new Store<Config>({
  name: 'config',
  defaults: {
    theme: 'light'
  }
});

export default store;
