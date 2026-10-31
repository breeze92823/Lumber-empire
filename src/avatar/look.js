// A whole dressed Bloxity character from a look { equipped, proportions, skin }, for the player and
// the others alike. A custom character (equipped.characterId) replaces the base rig, keeps the same
// bones and takes neither skin, body parts nor proportions; on null or a failed GLB the regular
// avatar is drawn. `stale()` says a newer load has started: the answer is then null.
import { getCharacterFor } from '../bloxity.js'
import { loadBaseCharacter, loadCustomCharacter } from './character.js'
import { applyProportions, attachEquippedAccessories } from './loader.js'

export async function buildLook({ equipped = null, proportions = null, skin = null }, stale) {
  const character = equipped ? await getCharacterFor(equipped) : null
  if (stale()) return null
  const custom = character?.glbUrl ? await loadCustomCharacter(character.glbUrl) : null
  if (stale()) return null
  const group = custom ?? (await loadBaseCharacter())
  if (stale()) return null
  await attachEquippedAccessories(group, equipped, { skinTextureUrl: skin, character: custom ? character : null })
  if (stale()) return null
  if (!custom) applyProportions(group, proportions)
  return group
}
