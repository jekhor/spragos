// Статистика и настройки в localStorage. Без хранилища всё работает, просто не запоминается.

const STATS_KEY = "lt-trainer-stats-v1";
const SETTINGS_KEY = "lt-trainer-settings-v1";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* хранилище недоступно */
  }
}

export function loadStats() {
  return read(STATS_KEY, { topics: {}, items: {} });
}

export function resetStats() {
  write(STATS_KEY, { topics: {}, items: {} });
}

/**
 * results — по одной записи на единицу раунда:
 * { topicFile, itemId, gaps, correct }  (correct — верных при первой проверке)
 */
export function recordRound(results) {
  const stats = loadStats();
  const touched = new Set();
  for (const r of results) {
    const t = (stats.topics[r.topicFile] ??= { rounds: 0, gaps: 0, correct: 0, last: null });
    t.gaps += r.gaps;
    t.correct += r.correct;
    t.last = new Date().toISOString();
    touched.add(r.topicFile);

    const prev = stats.items[r.itemId] || 0;
    const next = r.correct < r.gaps ? prev + 1 : Math.max(0, prev - 1);
    if (next) stats.items[r.itemId] = next;
    else delete stats.items[r.itemId];
  }
  for (const f of touched) stats.topics[f].rounds++;
  write(STATS_KEY, stats);
  return stats;
}

// Удалить статистику тем, подтем и заданий, которых больше нет в базе (например, после объединения тем).
export function pruneStats(topicKeys, itemIds) {
  const stats = loadStats();
  let changed = false;
  for (const k of Object.keys(stats.topics)) {
    if (!topicKeys.has(k)) {
      delete stats.topics[k];
      changed = true;
    }
  }
  for (const id of Object.keys(stats.items)) {
    if (!itemIds.has(id)) {
      delete stats.items[id];
      changed = true;
    }
  }
  if (changed) write(STATS_KEY, stats);
}

export function loadSettings(defaults) {
  return read(SETTINGS_KEY, defaults);
}

export function saveSettings(settings) {
  write(SETTINGS_KEY, settings);
}
