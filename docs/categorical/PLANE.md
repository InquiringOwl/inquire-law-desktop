# Card: plane (graphs, coordinate figures, draggable points)

Kit: `web/kits/categorical/plane.js` (on every `k`; no attach needed). Rules: `window.PlaneRules` (tested in `tests/universal.test.js`).

## The interaction rule (Precalculus onward; every new graph lab)
- **Every point that defines the figure is a handle the learner drags**: vertices, foci, intercepts you can set, endpoints, control points, the tip of a vector, the end of an angle's ray. The equation, readout and steps recompute live from the handles.
- **A point that belongs to a curve slides along it** (`on: x => f(x)`, or `path` for circles, ellipses, rays, segments, parametric and polar curves). A trace point that reads values off a graph is always a curve-glued handle.
- Every number in the lab's equation is changeable too (`k.vars`, universal kit): dragging a handle and editing a number are two views of the same state, so keep one source of truth and derive the other.
- Snap to friendly values (`snap: 0.5`, `snapX: π/12`) so exact answers stay reachable; keep exact rationals (`Q`) in the rules.
- Draw handles with `D.draw(P)` so they look grabbable (ring + halo on hover/drag/keyboard focus). At least one handle per graph mode; say what to drag in `k.hint` the first time.
- Keyboard and touch come free: Tab into the canvas, Tab/Shift+Tab between handles, arrows move (Shift ×5), glued points move along their curve; hit radius grows on touch screens.

## API
`P = k.plane(c, {xmin, xmax, ymin, ymax, equal, xstep, ystep, xlabel, ylabel, pad, avoid, modes})` inside the loop after `c.begin()`; it starts below the mode buttons automatically.
- From `k.plot`: `P.X(x) P.Y(y) P.inv(px, py) P.grid() P.axes() P.fn(f, color, w) P.line P.point P.label P.clip(fn)`, `P.xmin … P.ymax`, `P.left P.top P.width P.height`.
- `P.curve(f, color, {breaks, from, to, dash, w})` (no false joins across asymptotes/holes), `P.onCurve(f, at)` (a label anchor on the curve), `P.vasym(x)`, `P.hasym(y)`, `P.asym(f)` (dashed violet), `P.hole(x, y)`, `P.dot(x, y, color)`, `P.seg(x1, y1, x2, y2, color, w, dash)`, `P.param(fx, fy, t0, t1, color, w, dash)`, `P.implicit(G(x, y), color)` (conics, nonlinear systems), `P.shade(f, g, from, to, color)`, `P.handle(x, y, color, {hover, active, focus})`.
- **`P.labels([{text, x, y, color, font, prefer: "ne"|"nw"|…}])` — call LAST each frame**: places every label clear of the others, of the curves and handles drawn so far, of the tick numbers, the mode buttons and the edges. Use it for every canvas label near a curve.
- Several planes on one canvas share their avoid-lists in a frame (labels in one panel avoid the other's curves).

**Draggable points**: `D = k.drag(c, () => P, pts, (i, p) => {…}, {label: "Parabola", r})`, where each point is
`{x, y, color, name, snap | snapX | snapY, keyStep, clamp: [xmin, xmax, ymin, ymax], fixX, fixY, on: x => f(x), path: (x, y) => ({x, y}), off}`.
`D.active` / `D.hover` / `D.focus` (index or −1). Call `D.draw(P)` after the figure and before `P.labels`. Mutate `pts[i].x/y` yourself when the state changes from elsewhere (a scrubbed number moved the vertex): the next frame draws it there.
Useful projections: circle `path: (x, y) => { const r = Math.hypot(x - h, y - k) || 1; return { x: h + R * (x - h) / r, y: k + R * (y - k) / r }; }`; segment `PlaneRules.projectToSegment(x, y, ax, ay, bx, by)`; parametric curve `PlaneRules.nearestOnCurve(fx, fy, t0, t1, x, y, sx, sy)` (pass the plane's px-per-unit as sx, sy so "nearest" is on screen).

PlaneRules (DOM-free): `niceStep(span, target)`, `ticks(min, max, step)`, `placeLabels`, `projectToSegment`, `nearestOnCurve`, `dragTarget(p, mx, my, window)` (where a dragged point lands; test your constraint with it).
