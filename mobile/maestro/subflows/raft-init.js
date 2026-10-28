// A trip's bookkeeping for `raft-pick.js`: HOMES, the kinds already home
// on this trip's island ("1,2,3", or empty for an empty island).
output.raft = {
  homes: HOMES ? HOMES.split(',').map(Number) : [],
  crossings: 0,
  shore: [],
  load: [],
  boarded: '',
  i: 0,
}
