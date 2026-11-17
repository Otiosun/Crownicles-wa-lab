'use strict';
/** Group sender LID policy. This is NOT an authorization check.
 * BetaEntrance remains the sole authority for owner and one-use tokens.
 * Unknown unresolved LIDs may ask public-information questions only.
 */
const PUBLIC_INFO_COMMANDS = new Set(['/ajuda', '/comandos', '/grupo', '/regras']);
const OWNER_CHALLENGE_COMMANDS = new Set(['/ativar', '/desativar', '/vinculargrupo']);
function groupIdentityDisposition({command, verifiedAlias = false} = {}) {
  if (typeof command !== 'string') return 'private-only';
  const cmd = command.trim().toLowerCase();
  if (PUBLIC_INFO_COMMANDS.has(cmd)) return 'public-info';
  // Never authorize here: actual token/owner validation happens in BetaEntrance.
  if (OWNER_CHALLENGE_COMMANDS.has(cmd)) return 'owner-challenge';
  if (verifiedAlias === true) return 'verified-sender';
  return 'private-only';
}
module.exports = {groupIdentityDisposition};
