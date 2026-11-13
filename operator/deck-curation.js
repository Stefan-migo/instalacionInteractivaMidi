'use strict';

function selectAll(keys) { return new Set(keys || []); }
function selectNone() { return new Set(); }
function toggleSelection(current, key, orderedKeys, rangeAnchor) {
  const next = new Set(current || []);
  const keys = orderedKeys || [];
  if (rangeAnchor !== undefined && rangeAnchor !== null) {
    const start = keys.indexOf(rangeAnchor);
    const end = keys.indexOf(key);
    if (start !== -1 && end !== -1) {
      keys.slice(Math.min(start, end), Math.max(start, end) + 1).forEach(item => next.add(item));
      return next;
    }
  }
  if (next.has(key)) next.delete(key); else next.add(key);
  return next;
}
function warningMessage(available, cellCount) {
  const empty = Math.max(0, cellCount - available);
  return empty ? `${available} imágenes disponibles; al guardar quedarían vacías ${empty} de las ${cellCount} celdas.` : '';
}
function bulkActionMessage(count, className) { return `${count} imágenes en ${className}`; }
function sizeMarker(assignments, key) {
  const label = (assignments || {})[key] || '';
  return { assigned: Boolean(label), label };
}
function visibleImageKeys(keys, assignments, onlyUnassigned) {
  return (keys || []).filter(key => !onlyUnassigned || !sizeMarker(assignments, key).assigned);
}
function assignmentCount(total, assignments) {
  return { assigned: Object.keys(assignments || {}).filter(key => assignments[key]).length, total };
}
function replaceToast(toasts, key, message) {
  return (toasts || []).filter(toast => toast.key !== key).concat([{ key, message }]);
}
if (typeof module !== 'undefined' && module.exports) module.exports = { selectAll, selectNone, toggleSelection, warningMessage, bulkActionMessage, replaceToast, sizeMarker, visibleImageKeys, assignmentCount };
else if (typeof window !== 'undefined') window.DeckCuration = { selectAll, selectNone, toggleSelection, warningMessage, bulkActionMessage, replaceToast, sizeMarker, visibleImageKeys, assignmentCount };
