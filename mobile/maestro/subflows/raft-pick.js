// The load to board, for `raft-board.yaml`: from the shore's labels
// ("Cat, five", read into output.raft.shore), every set of animals whose
// weights make TARGET, and the cheapest by these costs, in order:
//
//   WANT   a weight the load must hold if any load does (9: the pig, for
//          the party's crossing); empty for none
//   then   a load that would fill the island's last empty home is avoided
//          (a crossing that must not party), unless WANT asks for it
//   then   the fewest kinds not yet home (output.raft.homes), so a
//          5-crossing run is unlikely to fill the island by chance
//   then   the fewest animals
//
// Writes output.raft.load (the labels to tap, in shore order) and adds the
// load's kinds to output.raft.homes: every animal aboard walks home.
var WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
}
var target = Number(TARGET)
var want = WANT ? Number(WANT) : 0
var raft = output.raft
var shore = raft.shore.map(function (label) {
  return { label: label, w: WORDS[label.split(', ')[1]] }
})
var best = null
var bestCost = Infinity
for (var m = 1; m < 1 << shore.length; m++) {
  var load = []
  var sum = 0
  for (var i = 0; i < shore.length; i++) {
    if (m & (1 << i)) {
      load.push(shore[i])
      sum += shore[i].w
    }
  }
  if (sum !== target) continue
  var kinds = {}
  load.forEach(function (a) {
    kinds[a.w] = true
  })
  var fresh = Object.keys(kinds).filter(function (k) {
    return raft.homes.indexOf(Number(k)) < 0
  }).length
  var fills = raft.homes.length + fresh === 9
  var cost =
    (want && !kinds[want] ? 10000 : 0) +
    (fills && !want ? 1000 : 0) +
    fresh * 10 +
    load.length
  if (cost < bestCost) {
    bestCost = cost
    best = load
  }
}
if (best === null) {
  throw new Error('raft-pick: no load to ' + target + ' on ' + raft.shore)
}
raft.load = best.map(function (a) {
  return a.label
})
best.forEach(function (a) {
  if (raft.homes.indexOf(a.w) < 0) raft.homes.push(a.w)
})
raft.boarded = best
  .map(function (a) {
    return a.w
  })
  .join('+')
console.log(
  'raft-pick: shore ' + raft.shore.join(' | ') + ' -> ' + raft.boarded,
)
