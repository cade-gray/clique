// A perspective narrows the board, list and stats to one group's projects. It sits apart from the
// filters so switching teams doesn't disturb them. '' is the whole board.

// A saved perspective can outlive its group, and the whole board is the only sensible thing to show then.
export function currentPerspective(saved, groups) {
  return groups.some((g) => g.id === saved) ? saved : '';
}

export function inPerspective(project, perspective) {
  return !perspective || project.groups.includes(perspective);
}

export function groupNames(project, groups) {
  return groups.filter((g) => project.groups.includes(g.id)).map((g) => g.name);
}
