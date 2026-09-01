/* Wegfindung: Die begehbaren Polygone eines Raums werden in ein Raster übertragen,
   darauf läuft A*. Danach wird der Pfad per Sichtlinie begradigt. */
(function (ATL) {
  const CELL = 8;

  class WalkGrid {
    constructor(polys, width, height) {
      this.cell = CELL;
      this.w = Math.ceil(width / CELL);
      this.h = Math.ceil(height / CELL);
      this.polys = polys || [];
      this.blocked = new Set();
      this.grid = new Uint8Array(this.w * this.h);
      this.rebuild();
    }
    rebuild() {
      for (let gy = 0; gy < this.h; gy++) {
        for (let gx = 0; gx < this.w; gx++) {
          const x = gx * CELL + CELL / 2, y = gy * CELL + CELL / 2;
          let ok = false;
          for (const p of this.polys) if (ATL.U.pointInPoly(x, y, p)) { ok = true; break; }
          if (ok) for (const b of this.blocked) if (ATL.U.pointInPoly(x, y, b)) { ok = false; break; }
          this.grid[gy * this.w + gx] = ok ? 1 : 0;
        }
      }
    }
    block(poly) { this.blocked.add(poly); this.rebuild(); }
    unblock(poly) { this.blocked.delete(poly); this.rebuild(); }
    free(gx, gy) { return gx >= 0 && gy >= 0 && gx < this.w && gy < this.h && this.grid[gy * this.w + gx] === 1; }
    walkable(x, y) { return this.free(Math.floor(x / CELL), Math.floor(y / CELL)); }
    toCell(x, y) { return [ATL.U.clamp(Math.floor(x / CELL), 0, this.w - 1), ATL.U.clamp(Math.floor(y / CELL), 0, this.h - 1)]; }
    toPoint(gx, gy) { return [gx * CELL + CELL / 2, gy * CELL + CELL / 2]; }

    nearestFree(x, y) {
      const [cx, cy] = this.toCell(x, y);
      if (this.free(cx, cy)) return [cx, cy];
      let best = null, bd = Infinity;
      const R = Math.max(this.w, this.h);
      for (let r = 1; r < R; r++) {
        for (let dx = -r; dx <= r; dx++) {
          for (let dy = -r; dy <= r; dy++) {
            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
            const gx = cx + dx, gy = cy + dy;
            if (this.free(gx, gy)) {
              const d = dx * dx + dy * dy;
              if (d < bd) { bd = d; best = [gx, gy]; }
            }
          }
        }
        if (best) return best;
      }
      return [cx, cy];
    }

    lineFree(x0, y0, x1, y1) {
      // prüft die Sichtlinie in Pixelkoordinaten in kleinen Schritten
      const d = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.max(1, Math.ceil(d / (CELL / 2)));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        if (!this.walkable(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
      }
      return true;
    }

    findPath(x0, y0, x1, y1) {
      const start = this.nearestFree(x0, y0);
      const goal = this.nearestFree(x1, y1);
      const gp = this.toPoint(goal[0], goal[1]);
      // Ziel innerhalb der Zelle genauer treffen, wenn es begehbar ist
      const target = this.walkable(x1, y1) ? [x1, y1] : gp;
      if (this.lineFree(x0, y0, target[0], target[1])) return [target];

      const key = (x, y) => y * this.w + x;
      const open = new Map();
      const closed = new Set();
      const came = new Map();
      const gScore = new Map();
      const h = (x, y) => Math.hypot(x - goal[0], y - goal[1]);
      const sk = key(start[0], start[1]);
      gScore.set(sk, 0);
      open.set(sk, h(start[0], start[1]));
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      let found = null;
      let guard = 0;
      while (open.size && guard++ < 200000) {
        let bestK = null, bestF = Infinity;
        for (const [k, f] of open) if (f < bestF) { bestF = f; bestK = k; }
        open.delete(bestK);
        const cx = bestK % this.w, cy = Math.floor(bestK / this.w);
        if (cx === goal[0] && cy === goal[1]) { found = bestK; break; }
        closed.add(bestK);
        for (const [dx, dy] of dirs) {
          const nx = cx + dx, ny = cy + dy;
          if (!this.free(nx, ny)) continue;
          if (dx && dy && (!this.free(cx + dx, cy) || !this.free(cx, cy + dy))) continue;
          const nk = key(nx, ny);
          if (closed.has(nk)) continue;
          const g = gScore.get(bestK) + (dx && dy ? 1.4142 : 1);
          if (g < (gScore.get(nk) ?? Infinity)) {
            gScore.set(nk, g);
            came.set(nk, bestK);
            open.set(nk, g + h(nx, ny));
          }
        }
      }
      if (found === null) return null;
      const cells = [];
      let k = found;
      while (k !== undefined) { cells.push([k % this.w, Math.floor(k / this.w)]); k = came.get(k); }
      cells.reverse();
      const pts = cells.map(([gx, gy]) => this.toPoint(gx, gy));
      pts[pts.length - 1] = target;
      // Begradigen
      const out = [];
      let cur = [x0, y0];
      let i = 0;
      while (i < pts.length) {
        let j = pts.length - 1;
        while (j > i && !this.lineFree(cur[0], cur[1], pts[j][0], pts[j][1])) j--;
        cur = pts[j];
        out.push(cur);
        i = j + 1;
      }
      return out;
    }
  }

  ATL.WalkGrid = WalkGrid;
})(window.ATL);
