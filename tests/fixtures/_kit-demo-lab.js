// Kit fixture for tools/interact.js: replaces the lesson-template lab with a lab that uses the interaction kit
// (k.drag free + curve-glued points, k.vars scrubbable numbers in k.eqline and the readout). State on window.__kd.
LABS["lesson-template"] = k => {
  MathKit.attach(k);
  const c = k.canvas(); let P = null;
  const S = k.vars([{ key: "a", value: 1, min: -5, max: 5, step: 0.5, cls: "c2", label: "a" }, { key: "b", value: 2, min: -10, max: 10, step: 1, cls: "c4", label: "b" }], () => sync());
  const pts = [{ x: 1, y: 1, snap: 0.5, color: k.C.amber, name: "A" }, { x: 2, y: 0, color: k.C.pink, name: "B", on: x => S.a * x * x + S.b }];
  const f = x => S.a * x * x + S.b;
  const sync = () => { pts[1].y = f(pts[1].x); window.__kd = { a: S.a, b: S.b, A: [pts[0].x, pts[0].y], B: [pts[1].x, pts[1].y] }; };
  const D = k.drag(c, () => P, pts, () => sync(), { label: "Kit demo" }); sync();
  k.loop(() => { c.begin(); P = k.plane(c, { xmin: -5, xmax: 5, ymin: -6, ymax: 14 }); window.__kdP = P; P.grid(); P.axes(); P.curve(f, k.C.cyan); D.draw(P);
    P.labels([{ text: "A", x: pts[0].x, y: pts[0].y, color: k.C.amber }, { text: "B", x: pts[1].x, y: pts[1].y, color: k.C.pink }]);
    k.eqline(`<i>y</i> = ${S.term("a", { v: "<i>x</i><sup>2</sup>", first: true })}${S.term("b")}`, "edit");
    k.readout({ title: "Kit demo", big: `<span class="m"><i>a</i> = ${S.html("a")}</span>`, rows: [{ lhs: "B", v: `(${k.fmt(pts[1].x)}, ${k.fmt(pts[1].y)})` }] }); });
};
