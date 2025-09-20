import { upAll } from 'docker-compose'

upAll({
  cwd: new URL('../..', import.meta.url).pathname,
  log: true,
  config: 'docker-compose.dev.yaml'
}).then(
  () => {
    console.log('done')
  },
  (err) => {
    console.log('Something went wrong:', err.message)
    console.log('Make sure to add your user to the docker group')
  }
)
