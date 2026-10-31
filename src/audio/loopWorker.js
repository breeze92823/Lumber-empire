// Renders the running sounds off the main thread (world.js), so a phone's first tap doesn't hitch.
import { renderLoop } from './loops.js'

self.onmessage = ({ data: name }) => {
  const samples = renderLoop(name)
  self.postMessage({ name, samples }, [samples.buffer])
}
