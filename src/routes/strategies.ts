import { Router } from "express";
import type Database from "better-sqlite3";
import { requireAuth } from "../middleware/auth-guard.js";
import { layout, escapeHtml } from "../layout.js";

interface StrategyRow {
  id: number;
  user_id: number;
  hole_id: number;
  bag_id: number;
  name: string;
  preferred_miss: string;
  no_go_zones: string;
  overall_notes: string;
  created_at: string;
}

interface StrategyWithContext extends StrategyRow {
  course_name: string;
  hole_number: number;
  par: number;
  yardage: number;
  bag_name: string;
}

interface ShotRow {
  id: number;
  strategy_id: number;
  shot_number: number;
  club: string;
  target: string;
  notes: string;
}

interface ClubRow {
  id: number;
  bag_id: number;
  name: string;
  carry_yards: number;
}

interface HoleRow {
  id: number;
  course_id: number;
  hole_number: number;
  par: number;
  yardage: number;
  geometry: string;
}

interface CourseRow {
  id: number;
  name: string;
  location: string;
  created_by: number;
  created_at: string;
}

interface BagRow {
  id: number;
  user_id: number;
  name: string;
  is_active: number;
  created_at: string;
}

export function createStrategiesRouter(db: Database.Database): Router {
  const router = Router();

  // List strategies for a hole
  router.get("/courses/:courseId/holes/:holeId/strategies", requireAuth, (req, res) => {
    const course = db
      .prepare("SELECT * FROM courses WHERE id = ?")
      .get(req.params.courseId) as CourseRow | undefined;

    if (!course) {
      res.status(404).send(notFoundPage("Course not found."));
      return;
    }

    const hole = db
      .prepare("SELECT * FROM holes WHERE id = ? AND course_id = ?")
      .get(req.params.holeId, req.params.courseId) as HoleRow | undefined;

    if (!hole) {
      res.status(404).send(notFoundPage("Hole not found."));
      return;
    }

    const strategies = db
      .prepare(
        `SELECT s.*, b.name as bag_name
         FROM strategies s
         JOIN bags b ON b.id = s.bag_id
         WHERE s.hole_id = ? AND s.user_id = ?
         ORDER BY s.created_at DESC`
      )
      .all(hole.id, req.session.userId!) as Array<StrategyRow & { bag_name: string }>;

    res.send(strategiesListPage(course, hole, strategies));
  });

  // New strategy form
  router.get("/courses/:courseId/holes/:holeId/strategies/new", requireAuth, (req, res) => {
    const course = db
      .prepare("SELECT * FROM courses WHERE id = ?")
      .get(req.params.courseId) as CourseRow | undefined;

    if (!course) {
      res.status(404).send(notFoundPage("Course not found."));
      return;
    }

    const hole = db
      .prepare("SELECT * FROM holes WHERE id = ? AND course_id = ?")
      .get(req.params.holeId, req.params.courseId) as HoleRow | undefined;

    if (!hole) {
      res.status(404).send(notFoundPage("Hole not found."));
      return;
    }

    const activeBag = db
      .prepare("SELECT * FROM bags WHERE user_id = ? AND is_active = 1")
      .get(req.session.userId!) as BagRow | undefined;

    if (!activeBag) {
      res.send(noBagPage(course, hole));
      return;
    }

    const clubs = db
      .prepare("SELECT * FROM clubs WHERE bag_id = ? ORDER BY carry_yards DESC")
      .all(activeBag.id) as ClubRow[];

    res.send(newStrategyPage(course, hole, activeBag, clubs));
  });

  // Create strategy
  router.post("/courses/:courseId/holes/:holeId/strategies", requireAuth, (req, res) => {
    const course = db
      .prepare("SELECT * FROM courses WHERE id = ?")
      .get(req.params.courseId) as CourseRow | undefined;

    if (!course) {
      res.status(404).send(notFoundPage("Course not found."));
      return;
    }

    const hole = db
      .prepare("SELECT * FROM holes WHERE id = ? AND course_id = ?")
      .get(req.params.holeId, req.params.courseId) as HoleRow | undefined;

    if (!hole) {
      res.status(404).send(notFoundPage("Hole not found."));
      return;
    }

    const body = req.body as Record<string, string | undefined>;
    const name = body.name;
    const bagId = parseInt(body.bag_id ?? "", 10);

    if (!name) {
      res.status(400).send(errorPage(course, hole, "Strategy name is required."));
      return;
    }

    if (isNaN(bagId)) {
      res.status(400).send(errorPage(course, hole, "Bag is required."));
      return;
    }

    // Verify bag belongs to user
    const bag = db
      .prepare("SELECT * FROM bags WHERE id = ? AND user_id = ?")
      .get(bagId, req.session.userId!) as BagRow | undefined;

    if (!bag) {
      res.status(404).send(notFoundPage("Bag not found."));
      return;
    }

    const preferredMiss = body.preferred_miss ?? "";
    const overallNotes = body.overall_notes ?? "";

    // Parse no-go zones from form
    const noGoZones: string[] = [];
    for (let i = 0; i < 10; i++) {
      const zone = body[`no_go_zone_${i}`];
      if (zone && zone.trim()) {
        noGoZones.push(zone.trim());
      }
    }

    const createStrategy = db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO strategies (user_id, hole_id, bag_id, name, preferred_miss, no_go_zones, overall_notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          req.session.userId!,
          hole.id,
          bag.id,
          name,
          preferredMiss,
          JSON.stringify(noGoZones),
          overallNotes
        );

      const strategyId = Number(result.lastInsertRowid);

      // Parse shots from form
      const insertShot = db.prepare(
        "INSERT INTO strategy_shots (strategy_id, shot_number, club, target, notes) VALUES (?, ?, ?, ?, ?)"
      );

      for (let i = 0; i < 20; i++) {
        const club = body[`shot_club_${i}`];
        if (!club) continue;

        const targetLat = body[`shot_target_lat_${i}`] ?? "";
        const targetLng = body[`shot_target_lng_${i}`] ?? "";
        const shotNotes = body[`shot_notes_${i}`] ?? "";

        const target: Record<string, number> = {};
        const lat = parseFloat(targetLat);
        const lng = parseFloat(targetLng);
        if (!isNaN(lat) && !isNaN(lng)) {
          target.lat = lat;
          target.lng = lng;
        }

        insertShot.run(strategyId, i + 1, club, JSON.stringify(target), shotNotes);
      }

      return strategyId;
    });

    const strategyId = createStrategy();
    res.redirect(
      `/courses/${course.id}/holes/${hole.id}/strategies/${strategyId}`
    );
  });

  // View single strategy
  router.get("/courses/:courseId/holes/:holeId/strategies/:strategyId", requireAuth, (req, res) => {
    const course = db
      .prepare("SELECT * FROM courses WHERE id = ?")
      .get(req.params.courseId) as CourseRow | undefined;

    if (!course) {
      res.status(404).send(notFoundPage("Course not found."));
      return;
    }

    const hole = db
      .prepare("SELECT * FROM holes WHERE id = ? AND course_id = ?")
      .get(req.params.holeId, req.params.courseId) as HoleRow | undefined;

    if (!hole) {
      res.status(404).send(notFoundPage("Hole not found."));
      return;
    }

    const strategy = db
      .prepare("SELECT * FROM strategies WHERE id = ? AND hole_id = ? AND user_id = ?")
      .get(req.params.strategyId, hole.id, req.session.userId!) as StrategyRow | undefined;

    if (!strategy) {
      res.status(404).send(notFoundPage("Strategy not found."));
      return;
    }

    const shots = db
      .prepare("SELECT * FROM strategy_shots WHERE strategy_id = ? ORDER BY shot_number")
      .all(strategy.id) as ShotRow[];

    const bag = db
      .prepare("SELECT * FROM bags WHERE id = ?")
      .get(strategy.bag_id) as BagRow | undefined;

    const clubs = bag
      ? (db
          .prepare("SELECT * FROM clubs WHERE bag_id = ? ORDER BY carry_yards DESC")
          .all(bag.id) as ClubRow[])
      : [];

    const clubMap = new Map(clubs.map((c) => [c.name, c.carry_yards]));

    res.send(strategyDetailPage(course, hole, strategy, shots, bag, clubMap));
  });

  // Edit strategy form
  router.get("/courses/:courseId/holes/:holeId/strategies/:strategyId/edit", requireAuth, (req, res) => {
    const course = db
      .prepare("SELECT * FROM courses WHERE id = ?")
      .get(req.params.courseId) as CourseRow | undefined;

    if (!course) {
      res.status(404).send(notFoundPage("Course not found."));
      return;
    }

    const hole = db
      .prepare("SELECT * FROM holes WHERE id = ? AND course_id = ?")
      .get(req.params.holeId, req.params.courseId) as HoleRow | undefined;

    if (!hole) {
      res.status(404).send(notFoundPage("Hole not found."));
      return;
    }

    const strategy = db
      .prepare("SELECT * FROM strategies WHERE id = ? AND hole_id = ? AND user_id = ?")
      .get(req.params.strategyId, hole.id, req.session.userId!) as StrategyRow | undefined;

    if (!strategy) {
      res.status(404).send(notFoundPage("Strategy not found."));
      return;
    }

    const shots = db
      .prepare("SELECT * FROM strategy_shots WHERE strategy_id = ? ORDER BY shot_number")
      .all(strategy.id) as ShotRow[];

    const bag = db
      .prepare("SELECT * FROM bags WHERE id = ?")
      .get(strategy.bag_id) as BagRow | undefined;

    const clubs = bag
      ? (db
          .prepare("SELECT * FROM clubs WHERE bag_id = ? ORDER BY carry_yards DESC")
          .all(bag.id) as ClubRow[])
      : [];

    res.send(editStrategyPage(course, hole, strategy, shots, bag, clubs));
  });

  // Update strategy
  router.post("/courses/:courseId/holes/:holeId/strategies/:strategyId", requireAuth, (req, res) => {
    const course = db
      .prepare("SELECT * FROM courses WHERE id = ?")
      .get(req.params.courseId) as CourseRow | undefined;

    if (!course) {
      res.status(404).send(notFoundPage("Course not found."));
      return;
    }

    const hole = db
      .prepare("SELECT * FROM holes WHERE id = ? AND course_id = ?")
      .get(req.params.holeId, req.params.courseId) as HoleRow | undefined;

    if (!hole) {
      res.status(404).send(notFoundPage("Hole not found."));
      return;
    }

    const strategy = db
      .prepare("SELECT * FROM strategies WHERE id = ? AND hole_id = ? AND user_id = ?")
      .get(req.params.strategyId, hole.id, req.session.userId!) as StrategyRow | undefined;

    if (!strategy) {
      res.status(404).send(notFoundPage("Strategy not found."));
      return;
    }

    const body = req.body as Record<string, string | undefined>;
    const name = body.name;

    if (!name) {
      res.status(400).send(errorPage(course, hole, "Strategy name is required."));
      return;
    }

    const preferredMiss = body.preferred_miss ?? "";
    const overallNotes = body.overall_notes ?? "";

    const noGoZones: string[] = [];
    for (let i = 0; i < 10; i++) {
      const zone = body[`no_go_zone_${i}`];
      if (zone && zone.trim()) {
        noGoZones.push(zone.trim());
      }
    }

    const updateStrategy = db.transaction(() => {
      db.prepare(
        `UPDATE strategies SET name = ?, preferred_miss = ?, no_go_zones = ?, overall_notes = ?
         WHERE id = ?`
      ).run(name, preferredMiss, JSON.stringify(noGoZones), overallNotes, strategy.id);

      // Replace shots: delete existing, re-insert from form
      db.prepare("DELETE FROM strategy_shots WHERE strategy_id = ?").run(strategy.id);

      const insertShot = db.prepare(
        "INSERT INTO strategy_shots (strategy_id, shot_number, club, target, notes) VALUES (?, ?, ?, ?, ?)"
      );

      for (let i = 0; i < 20; i++) {
        const club = body[`shot_club_${i}`];
        if (!club) continue;

        const targetLat = body[`shot_target_lat_${i}`] ?? "";
        const targetLng = body[`shot_target_lng_${i}`] ?? "";
        const shotNotes = body[`shot_notes_${i}`] ?? "";

        const target: Record<string, number> = {};
        const lat = parseFloat(targetLat);
        const lng = parseFloat(targetLng);
        if (!isNaN(lat) && !isNaN(lng)) {
          target.lat = lat;
          target.lng = lng;
        }

        insertShot.run(strategy.id, i + 1, club, JSON.stringify(target), shotNotes);
      }
    });

    updateStrategy();
    res.redirect(
      `/courses/${course.id}/holes/${hole.id}/strategies/${strategy.id}`
    );
  });

  // Delete strategy
  router.post("/courses/:courseId/holes/:holeId/strategies/:strategyId/delete", requireAuth, (req, res) => {
    const course = db
      .prepare("SELECT * FROM courses WHERE id = ?")
      .get(req.params.courseId) as CourseRow | undefined;

    if (!course) {
      res.status(404).send(notFoundPage("Course not found."));
      return;
    }

    const hole = db
      .prepare("SELECT * FROM holes WHERE id = ? AND course_id = ?")
      .get(req.params.holeId, req.params.courseId) as HoleRow | undefined;

    if (!hole) {
      res.status(404).send(notFoundPage("Hole not found."));
      return;
    }

    const strategy = db
      .prepare("SELECT * FROM strategies WHERE id = ? AND hole_id = ? AND user_id = ?")
      .get(req.params.strategyId, hole.id, req.session.userId!) as StrategyRow | undefined;

    if (!strategy) {
      res.status(404).send(notFoundPage("Strategy not found."));
      return;
    }

    db.prepare("DELETE FROM strategies WHERE id = ?").run(strategy.id);
    res.redirect(`/courses/${course.id}/holes/${hole.id}/strategies`);
  });

  return router;
}

function strategiesListPage(
  course: CourseRow,
  hole: HoleRow,
  strategies: Array<StrategyRow & { bag_name: string }>
): string {
  const rows = strategies
    .map(
      (s) =>
        `<tr>
          <td><a href="/courses/${course.id}/holes/${hole.id}/strategies/${s.id}">${escapeHtml(s.name)}</a></td>
          <td>${escapeHtml(s.bag_name)}</td>
          <td>${s.created_at}</td>
        </tr>`
    )
    .join("");

  const body = `<h1>Strategies for Hole ${hole.hole_number} - ${escapeHtml(course.name)}</h1>
  <p>Par ${hole.par} | ${hole.yardage} yards</p>
  <div class="actions">
    <a href="/courses/${course.id}/holes/${hole.id}/strategies/new" class="btn">New strategy</a>
  </div>
  ${
    strategies.length === 0
      ? `<p class="empty">No strategies yet.</p>`
      : `<div class="table-wrap"><table>
          <thead><tr><th>Name</th><th>Bag</th><th>Created</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`
  }
  <p><a href="/courses/${course.id}">Back to course</a></p>`;
  return layout(`Strategies - Hole ${hole.hole_number}`, body);
}

function noBagPage(course: CourseRow, hole: HoleRow): string {
  const body = `<h1>No Active Bag</h1>
  <p>You need an active bag to create a strategy. <a href="/bags">Set up a bag</a> first.</p>
  <p><a href="/courses/${course.id}/holes/${hole.id}/strategies">Back to strategies</a></p>`;
  return layout("No Active Bag", body);
}

function newStrategyPage(
  course: CourseRow,
  hole: HoleRow,
  bag: BagRow,
  clubs: ClubRow[],
  error?: string
): string {
  const clubOptions = clubs
    .map((c) => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)} (${c.carry_yards}y)</option>`)
    .join("");

  const shotRows: string[] = [];
  for (let i = 0; i < 5; i++) {
    shotRows.push(`<div class="shot-block">
      <h4>Shot ${i + 1}</h4>
      <div class="form-group">
        <label>Club</label>
        <select name="shot_club_${i}"><option value="">--</option>${clubOptions}</select>
      </div>
      <div class="coord-row">
        <div class="form-group">
          <label>Target Lat</label>
          <input type="text" name="shot_target_lat_${i}">
        </div>
        <div class="form-group">
          <label>Target Lng</label>
          <input type="text" name="shot_target_lng_${i}">
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <input type="text" name="shot_notes_${i}">
      </div>
    </div>`);
  }

  const body = `<h1>New Strategy - Hole ${hole.hole_number} (${escapeHtml(course.name)})</h1>
  <p>Par ${hole.par} | ${hole.yardage} yards | Using: ${escapeHtml(bag.name)}</p>
  ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
  <div class="card">
    <form method="POST" action="/courses/${course.id}/holes/${hole.id}/strategies">
      <input type="hidden" name="bag_id" value="${bag.id}">
      <div class="form-group">
        <label for="name">Strategy name</label>
        <input type="text" id="name" name="name" required placeholder="e.g. safe, aggressive">
      </div>
      <h3>Shots</h3>
      ${shotRows.join("")}
      <h3>Strategy Notes</h3>
      <div class="form-group">
        <label for="preferred_miss">Preferred miss</label>
        <input type="text" id="preferred_miss" name="preferred_miss" placeholder="e.g. left side">
      </div>
      <div class="form-group">
        <label>No-go zone</label>
        <input type="text" name="no_go_zone_0" placeholder="e.g. bunker right">
      </div>
      <div class="form-group">
        <label>No-go zone</label>
        <input type="text" name="no_go_zone_1" placeholder="e.g. OOB left">
      </div>
      <div class="form-group">
        <label for="overall_notes">Overall notes</label>
        <textarea id="overall_notes" name="overall_notes" rows="3"></textarea>
      </div>
      <div class="form-actions">
        <button type="submit">Create Strategy</button>
      </div>
    </form>
  </div>
  <p><a href="/courses/${course.id}/holes/${hole.id}/strategies">Back to strategies</a></p>`;
  return layout("New Strategy", body);
}

function strategyDetailPage(
  course: CourseRow,
  hole: HoleRow,
  strategy: StrategyRow,
  shots: ShotRow[],
  bag: BagRow | undefined,
  clubMap: Map<string, number>
): string {
  const noGoZones = JSON.parse(strategy.no_go_zones) as string[];

  const shotRows = shots
    .map((s) => {
      const carry = clubMap.get(s.club);
      const target = JSON.parse(s.target) as { lat?: number; lng?: number };
      const targetStr =
        target.lat !== undefined && target.lng !== undefined
          ? `${target.lat.toFixed(6)}, ${target.lng.toFixed(6)}`
          : "-";

      return `<tr>
        <td>${s.shot_number}</td>
        <td>${escapeHtml(s.club)}</td>
        <td>${carry !== undefined ? `${carry}y` : "-"}</td>
        <td>${targetStr}</td>
        <td>${escapeHtml(s.notes)}</td>
      </tr>`;
    })
    .join("");

  const body = `<h1>${escapeHtml(strategy.name)} - Hole ${hole.hole_number} (${escapeHtml(course.name)})</h1>
  <p>Par ${hole.par} | ${hole.yardage} yards | Bag: ${bag ? escapeHtml(bag.name) : "deleted"}</p>
  <div class="actions">
    <a href="/courses/${course.id}/holes/${hole.id}/strategies/${strategy.id}/edit" class="btn">Edit strategy</a>
    <form method="POST" action="/courses/${course.id}/holes/${hole.id}/strategies/${strategy.id}/delete">
      <button type="submit" class="btn btn-danger">Delete strategy</button>
    </form>
  </div>
  <h2>Shots</h2>
  ${
    shots.length === 0
      ? `<p class="empty">No shots planned.</p>`
      : `<div class="table-wrap"><table>
          <thead><tr><th>#</th><th>Club</th><th>Carry</th><th>Target</th><th>Notes</th></tr></thead>
          <tbody>${shotRows}</tbody>
        </table></div>`
  }
  <h2>Strategy Notes</h2>
  <div class="card">
    <p><strong>Preferred miss:</strong> ${escapeHtml(strategy.preferred_miss) || "-"}</p>
    <p><strong>No-go zones:</strong> ${noGoZones.length > 0 ? noGoZones.map(escapeHtml).join(", ") : "-"}</p>
    <p><strong>Notes:</strong> ${escapeHtml(strategy.overall_notes) || "-"}</p>
  </div>
  <p><a href="/courses/${course.id}/holes/${hole.id}/strategies">Back to strategies</a></p>`;
  return layout(strategy.name, body);
}

function editStrategyPage(
  course: CourseRow,
  hole: HoleRow,
  strategy: StrategyRow,
  shots: ShotRow[],
  bag: BagRow | undefined,
  clubs: ClubRow[],
  error?: string
): string {
  const noGoZones = JSON.parse(strategy.no_go_zones) as string[];

  const clubOptions = (selected: string) =>
    clubs
      .map(
        (c) =>
          `<option value="${escapeHtml(c.name)}" ${c.name === selected ? "selected" : ""}>${escapeHtml(c.name)} (${c.carry_yards}y)</option>`
      )
      .join("");

  // Render existing shots + one empty row
  const totalRows = Math.max(shots.length + 1, 5);
  const shotFields: string[] = [];
  for (let i = 0; i < totalRows; i++) {
    const shot = shots[i];
    const target = shot ? (JSON.parse(shot.target) as { lat?: number; lng?: number }) : {};

    shotFields.push(`<div class="shot-block">
      <h4>Shot ${i + 1}</h4>
      <div class="form-group">
        <label>Club</label>
        <select name="shot_club_${i}"><option value="">--</option>${clubOptions(shot?.club ?? "")}</select>
      </div>
      <div class="coord-row">
        <div class="form-group">
          <label>Target Lat</label>
          <input type="text" name="shot_target_lat_${i}" value="${target.lat ?? ""}">
        </div>
        <div class="form-group">
          <label>Target Lng</label>
          <input type="text" name="shot_target_lng_${i}" value="${target.lng ?? ""}">
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <input type="text" name="shot_notes_${i}" value="${shot ? escapeHtml(shot.notes) : ""}">
      </div>
    </div>`);
  }

  // Render no-go zones + one empty row
  const totalZones = Math.max(noGoZones.length + 1, 2);
  const zoneFields: string[] = [];
  for (let i = 0; i < totalZones; i++) {
    zoneFields.push(
      `<div class="form-group">
        <label>No-go zone</label>
        <input type="text" name="no_go_zone_${i}" value="${escapeHtml(noGoZones[i] ?? "")}">
      </div>`
    );
  }

  const body = `<h1>Edit Strategy - Hole ${hole.hole_number} (${escapeHtml(course.name)})</h1>
  <p>Bag: ${bag ? escapeHtml(bag.name) : "deleted"}</p>
  ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
  <div class="card">
    <form method="POST" action="/courses/${course.id}/holes/${hole.id}/strategies/${strategy.id}">
      <div class="form-group">
        <label for="name">Strategy name</label>
        <input type="text" id="name" name="name" required value="${escapeHtml(strategy.name)}">
      </div>
      <h3>Shots</h3>
      ${shotFields.join("")}
      <h3>Strategy Notes</h3>
      <div class="form-group">
        <label for="preferred_miss">Preferred miss</label>
        <input type="text" id="preferred_miss" name="preferred_miss" value="${escapeHtml(strategy.preferred_miss)}">
      </div>
      ${zoneFields.join("")}
      <div class="form-group">
        <label for="overall_notes">Overall notes</label>
        <textarea id="overall_notes" name="overall_notes" rows="3">${escapeHtml(strategy.overall_notes)}</textarea>
      </div>
      <div class="form-actions">
        <button type="submit">Save Strategy</button>
      </div>
    </form>
  </div>
  <p><a href="/courses/${course.id}/holes/${hole.id}/strategies/${strategy.id}">Back to strategy</a></p>`;
  return layout("Edit Strategy", body);
}

function errorPage(course: CourseRow, hole: HoleRow, message: string): string {
  const body = `<h1>Error</h1>
  <div class="error">${escapeHtml(message)}</div>
  <p><a href="/courses/${course.id}/holes/${hole.id}/strategies">Back to strategies</a></p>`;
  return layout("Error", body);
}

function notFoundPage(message: string): string {
  const body = `<h1>Not Found</h1>
  <p>${escapeHtml(message)}</p>
  <p><a href="/courses">Back to courses</a></p>`;
  return layout("Not Found", body);
}
