// Перетаскивание плашек на Pointer Events (мышь и палец).
// Клики/тапы сюда не относятся — их обрабатывает app.js через обычный click.

const DRAG_THRESHOLD = 6; // px — меньше считается кликом

/**
 * root   — контейнер, внутри которого живут плашки (.chip) и цели (.gap, .bank)
 * onDrop(chipId, target) — target: элемент .gap / .bank или null (бросили мимо)
 */
export function enableDragAndDrop(root, onDrop) {
  let st = null;

  root.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const chip = e.target.closest(".chip");
    if (!chip || chip.classList.contains("locked") || !root.contains(chip)) return;
    st = { chip, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, ghost: null, over: null };
    chip.setPointerCapture(e.pointerId);
  });

  root.addEventListener("pointermove", (e) => {
    if (!st || e.pointerId !== st.pointerId) return;
    if (!st.ghost) {
      if (Math.hypot(e.clientX - st.x0, e.clientY - st.y0) < DRAG_THRESHOLD) return;
      startDrag(e);
    }
    e.preventDefault();
    moveGhost(e.clientX, e.clientY);
    const target = targetAt(e.clientX, e.clientY);
    if (target !== st.over) {
      st.over?.classList.remove("drop-over");
      target?.classList.add("drop-over");
      st.over = target;
    }
  });

  const finish = (e, cancelled) => {
    if (!st || e.pointerId !== st.pointerId) return;
    const { chip, ghost, over } = st;
    st = null;
    if (!ghost) return; // это был клик
    ghost.remove();
    chip.classList.remove("dragging");
    over?.classList.remove("drop-over");
    document.body.classList.remove("is-dragging");
    swallowClickAt(e.clientX, e.clientY);
    if (!cancelled) onDrop(chip.dataset.chip, targetAt(e.clientX, e.clientY));
  };
  root.addEventListener("pointerup", (e) => finish(e, false));
  root.addEventListener("pointercancel", (e) => finish(e, true));

  function startDrag(e) {
    const rect = st.chip.getBoundingClientRect();
    const ghost = st.chip.cloneNode(true);
    ghost.classList.add("ghost");
    ghost.classList.remove("selected");
    ghost.style.width = rect.width + "px";
    st.dx = e.clientX - rect.left;
    st.dy = e.clientY - rect.top;
    document.body.appendChild(ghost);
    st.ghost = ghost;
    st.chip.classList.add("dragging");
    document.body.classList.add("is-dragging");
  }

  function moveGhost(x, y) {
    st.ghost.style.transform = `translate(${x - st.dx}px, ${y - st.dy}px)`;
  }

  function targetAt(x, y) {
    const el = document.elementFromPoint(x, y);
    const t = el?.closest(".gap:not(.locked), .bank");
    return t && root.contains(t) ? t : null;
  }
}

// После перетаскивания браузер может прислать click в точке отпускания — его надо проглотить.
// Клики в других местах (следующее действие пользователя) не трогаем.
function swallowClickAt(x, y) {
  const stop = (e) => {
    if (Math.hypot(e.clientX - x, e.clientY - y) > 3) return;
    e.stopPropagation();
    e.preventDefault();
    window.removeEventListener("click", stop, true);
  };
  window.addEventListener("click", stop, true);
  setTimeout(() => window.removeEventListener("click", stop, true), 400);
}
