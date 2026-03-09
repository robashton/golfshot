import { Router } from "express";
import type Database from "better-sqlite3";
import { requireAuth } from "../middleware/auth-guard.js";
import { searchGolfCourses } from "../osm/nominatim.js";
import { fetchCourseData } from "../osm/overpass.js";
import type { NominatimResult } from "../osm/nominatim.js";
import type { ParsedCourse } from "../osm/overpass.js";
import { layout, escapeHtml } from "../layout.js";

interface CourseRow {
  id: number;
  name: string;
  location: string;
  created_by: number;
  created_at: string;
}

interface CourseWithCount extends CourseRow {
  hole_count: number;
}

interface HoleRow {
  id: number;
  course_id: number;
  hole_number: number;
  par: number;
  yardage: number;
  geometry: string;
}

interface HoleGeometry {
  tee?: { lat: number; lng: number };
  green?: { lat: number; lng: number };
  hazards?: Array<{ name: string; lat: number; lng: number }>;
  layups?: Array<{ name: string; lat: number; lng: number }>;
  fairway_points?: Array<{ lat: number; lng: number }>;
}

interface SeedHole {
  number: number;
  name?: string;
  par: number;
  yards: number;
  tee?: [number, number];
  green?: [number, number];
  layup?: [number, number];
  [key: string]: unknown;
}

interface SeedData {
  course: string;
  holes: SeedHole[];
}

export function createCoursesRouter(db: Database.Database): Router {
  const router = Router();

  // List all courses
  router.get("/courses", requireAuth, (_req, res) => {
    const courses = db
      .prepare(
        `SELECT c.*, COUNT(h.id) as hole_count
         FROM courses c
         LEFT JOIN holes h ON h.course_id = c.id
         GROUP BY c.id
         ORDER BY c.created_at DESC`
      )
      .all() as CourseWithCount[];

    res.send(coursesListPage(courses));
  });

  // New course form
  router.get("/courses/new", requireAuth, (_req, res) => {
    res.send(newCoursePage());
  });

  // Import stub page
  router.get("/courses/import", requireAuth, (_req, res) => {
    res.send(importPage());
  });

  // Import seed data
  router.post("/courses/import-seed", requireAuth, (req, res) => {
    const { json } = req.body as { json?: string };
    if (!json) {
      res.status(400).send(importPage("JSON data is required."));
      return;
    }

    let seedData: SeedData;
    try {
      seedData = JSON.parse(json) as SeedData;
    } catch {
      res.status(400).send(importPage("Invalid JSON format."));
      return;
    }

    if (!seedData.course || !Array.isArray(seedData.holes)) {
      res.status(400).send(importPage('JSON must have "course" and "holes" fields.'));
      return;
    }

    const insertCourse = db.prepare(
      "INSERT INTO courses (name, location, created_by) VALUES (?, ?, ?)"
    );
    const insertHole = db.prepare(
      "INSERT INTO holes (course_id, hole_number, par, yardage, geometry) VALUES (?, ?, ?, ?, ?)"
    );

    const importAll = db.transaction(() => {
      const result = insertCourse.run(seedData.course, "", req.session.userId!);
      const courseId = Number(result.lastInsertRowid);

      for (const hole of seedData.holes) {
        const geometry: HoleGeometry = {};
        if (hole.tee) {
          geometry.tee = { lat: hole.tee[0], lng: hole.tee[1] };
        }
        if (hole.green) {
          geometry.green = { lat: hole.green[0], lng: hole.green[1] };
        }

        // Collect known named points as hazards/layups
        const hazards: Array<{ name: string; lat: number; lng: number }> = [];
        const layups: Array<{ name: string; lat: number; lng: number }> = [];

        if (hole.layup) {
          layups.push({ name: "Layup", lat: hole.layup[0], lng: hole.layup[1] });
        }

        // Import any extra coordinate pairs as hazards (brookA, brookB, crest, etc.)
        const knownKeys = new Set(["number", "name", "par", "yards", "tee", "green", "layup", "stock_plan", "notes"]);
        for (const [key, value] of Object.entries(hole)) {
          if (!knownKeys.has(key) && Array.isArray(value) && value.length === 2 && typeof value[0] === "number") {
            hazards.push({ name: key, lat: value[0] as number, lng: value[1] as number });
          }
        }

        if (hazards.length > 0) geometry.hazards = hazards;
        if (layups.length > 0) geometry.layups = layups;

        insertHole.run(courseId, hole.number, hole.par, hole.yards, JSON.stringify(geometry));
      }

      return courseId;
    });

    const courseId = importAll();
    res.redirect(`/courses/${courseId}`);
  });

  // Search OSM for golf courses
  router.get("/courses/import/search", requireAuth, async (req, res, next) => {
    const q = (req.query.q as string | undefined) ?? "";
    if (!q.trim()) {
      res.redirect("/courses/import");
      return;
    }

    try {
      const results = await searchGolfCourses(q);
      res.send(searchResultsPage(q, results));
    } catch (err) {
      next(err);
    }
  });

  // Preview OSM course data before import
  router.get("/courses/import/preview", requireAuth, async (req, res, next) => {
    const osmType = req.query.osm_type as string | undefined;
    const osmIdStr = req.query.osm_id as string | undefined;
    const name = req.query.name as string | undefined;
    const location = req.query.location as string | undefined;
    const lat = req.query.lat as string | undefined;
    const lon = req.query.lon as string | undefined;

    if (!osmType || !osmIdStr) {
      res.status(400).send(importPage("Missing OSM type or ID."));
      return;
    }

    const osmId = parseInt(osmIdStr, 10);
    if (isNaN(osmId)) {
      res.status(400).send(importPage("Invalid OSM ID."));
      return;
    }

    try {
      const course = await fetchCourseData(
        osmType,
        osmId,
        name ?? "Unknown Course",
        location ?? "",
        lat ? parseFloat(lat) : undefined,
        lon ? parseFloat(lon) : undefined
      );
      res.send(previewPage(course, osmType, osmId, lat, lon));
    } catch (err) {
      next(err);
    }
  });

  // Import course from OSM
  router.post("/courses/import/osm", requireAuth, async (req, res, next) => {
    const { osm_type, osm_id, name, location, lat, lon } = req.body as Record<string, string>;

    if (!osm_type || !osm_id) {
      res.status(400).send(importPage("Missing OSM type or ID."));
      return;
    }

    const osmId = parseInt(osm_id, 10);
    if (isNaN(osmId)) {
      res.status(400).send(importPage("Invalid OSM ID."));
      return;
    }

    try {
      const course = await fetchCourseData(
        osm_type,
        osmId,
        name ?? "Unknown Course",
        location ?? "",
        lat ? parseFloat(lat) : undefined,
        lon ? parseFloat(lon) : undefined
      );

      const insertCourse = db.prepare(
        "INSERT INTO courses (name, location, created_by) VALUES (?, ?, ?)"
      );
      const insertHole = db.prepare(
        "INSERT INTO holes (course_id, hole_number, par, yardage, geometry) VALUES (?, ?, ?, ?, ?)"
      );

      const importAll = db.transaction(() => {
        const result = insertCourse.run(course.name, course.location, req.session.userId!);
        const courseId = Number(result.lastInsertRowid);

        for (const hole of course.holes) {
          const geometry: HoleGeometry = {};
          if (hole.tee) geometry.tee = hole.tee;
          if (hole.green) geometry.green = hole.green;
          if (hole.hazards && hole.hazards.length > 0) geometry.hazards = hole.hazards;

          insertHole.run(
            courseId,
            hole.number,
            hole.par,
            hole.yardage,
            JSON.stringify(geometry)
          );
        }

        return courseId;
      });

      const courseId = importAll();
      res.redirect(`/courses/${courseId}`);
    } catch (err) {
      next(err);
    }
  });

  // Create course
  router.post("/courses", requireAuth, (req, res) => {
    const { name, location } = req.body as { name?: string; location?: string };

    if (!name) {
      res.status(400).send(newCoursePage("Course name is required."));
      return;
    }

    const result = db
      .prepare("INSERT INTO courses (name, location, created_by) VALUES (?, ?, ?)")
      .run(name, location ?? "", req.session.userId!);

    res.redirect(`/courses/${result.lastInsertRowid}`);
  });

  // View single course
  router.get("/courses/:id", requireAuth, (req, res) => {
    const course = db
      .prepare("SELECT * FROM courses WHERE id = ?")
      .get(req.params.id) as CourseRow | undefined;

    if (!course) {
      res.status(404).send(notFoundPage("Course not found."));
      return;
    }

    const holes = db
      .prepare("SELECT * FROM holes WHERE course_id = ? ORDER BY hole_number")
      .all(req.params.id) as HoleRow[];

    res.send(courseDetailPage(course, holes));
  });

  // Edit course form
  router.get("/courses/:id/edit", requireAuth, (req, res) => {
    const course = db
      .prepare("SELECT * FROM courses WHERE id = ?")
      .get(req.params.id) as CourseRow | undefined;

    if (!course) {
      res.status(404).send(notFoundPage("Course not found."));
      return;
    }

    res.send(editCoursePage(course));
  });

  // Update course
  router.post("/courses/:id", requireAuth, (req, res) => {
    const course = db
      .prepare("SELECT * FROM courses WHERE id = ?")
      .get(req.params.id) as CourseRow | undefined;

    if (!course) {
      res.status(404).send(notFoundPage("Course not found."));
      return;
    }

    const { name, location } = req.body as { name?: string; location?: string };

    if (!name) {
      res.status(400).send(editCoursePage(course, "Course name is required."));
      return;
    }

    db.prepare("UPDATE courses SET name = ?, location = ? WHERE id = ?").run(
      name,
      location ?? "",
      req.params.id
    );

    res.redirect(`/courses/${req.params.id}`);
  });

  // Delete course
  router.post("/courses/:id/delete", requireAuth, (req, res) => {
    const course = db
      .prepare("SELECT * FROM courses WHERE id = ?")
      .get(req.params.id) as CourseRow | undefined;

    if (!course) {
      res.status(404).send(notFoundPage("Course not found."));
      return;
    }

    db.prepare("DELETE FROM courses WHERE id = ?").run(req.params.id);
    res.redirect("/courses");
  });

  // Add hole form
  router.get("/courses/:id/holes/new", requireAuth, (req, res) => {
    const course = db
      .prepare("SELECT * FROM courses WHERE id = ?")
      .get(req.params.id) as CourseRow | undefined;

    if (!course) {
      res.status(404).send(notFoundPage("Course not found."));
      return;
    }

    res.send(newHolePage(course));
  });

  // Create hole
  router.post("/courses/:id/holes", requireAuth, (req, res) => {
    const course = db
      .prepare("SELECT * FROM courses WHERE id = ?")
      .get(req.params.id) as CourseRow | undefined;

    if (!course) {
      res.status(404).send(notFoundPage("Course not found."));
      return;
    }

    const body = req.body as Record<string, string | undefined>;
    const holeNumber = parseInt(body.hole_number ?? "", 10);
    const par = parseInt(body.par ?? "", 10);
    const yardage = parseInt(body.yardage ?? "", 10);

    if (isNaN(holeNumber) || isNaN(par) || isNaN(yardage)) {
      res.status(400).send(newHolePage(course, "Hole number, par, and yardage are required."));
      return;
    }

    const geometry = buildGeometryFromBody(body);

    try {
      db.prepare(
        "INSERT INTO holes (course_id, hole_number, par, yardage, geometry) VALUES (?, ?, ?, ?, ?)"
      ).run(course.id, holeNumber, par, yardage, JSON.stringify(geometry));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("UNIQUE constraint")) {
        res.status(409).send(newHolePage(course, `Hole ${holeNumber} already exists on this course.`));
        return;
      }
      throw err;
    }

    res.redirect(`/courses/${course.id}`);
  });

  // Edit hole form
  router.get("/courses/:courseId/holes/:holeId/edit", requireAuth, (req, res) => {
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

    res.send(editHolePage(course, hole));
  });

  // Update hole
  router.post("/courses/:courseId/holes/:holeId", requireAuth, (req, res) => {
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
    const holeNumber = parseInt(body.hole_number ?? "", 10);
    const par = parseInt(body.par ?? "", 10);
    const yardage = parseInt(body.yardage ?? "", 10);

    if (isNaN(holeNumber) || isNaN(par) || isNaN(yardage)) {
      res.status(400).send(editHolePage(course, hole, "Hole number, par, and yardage are required."));
      return;
    }

    const geometry = buildGeometryFromBody(body);

    db.prepare(
      "UPDATE holes SET hole_number = ?, par = ?, yardage = ?, geometry = ? WHERE id = ?"
    ).run(holeNumber, par, yardage, JSON.stringify(geometry), hole.id);

    res.redirect(`/courses/${course.id}`);
  });

  // Delete hole
  router.post("/courses/:courseId/holes/:holeId/delete", requireAuth, (req, res) => {
    const course = db
      .prepare("SELECT * FROM courses WHERE id = ?")
      .get(req.params.courseId) as CourseRow | undefined;

    if (!course) {
      res.status(404).send(notFoundPage("Course not found."));
      return;
    }

    db.prepare("DELETE FROM holes WHERE id = ? AND course_id = ?").run(
      req.params.holeId,
      req.params.courseId
    );

    res.redirect(`/courses/${course.id}`);
  });

  return router;
}

function buildGeometryFromBody(body: Record<string, string | undefined>): HoleGeometry {
  const geometry: HoleGeometry = {};

  const teeLat = parseFloat(body.tee_lat ?? "");
  const teeLng = parseFloat(body.tee_lng ?? "");
  if (!isNaN(teeLat) && !isNaN(teeLng)) {
    geometry.tee = { lat: teeLat, lng: teeLng };
  }

  const greenLat = parseFloat(body.green_lat ?? "");
  const greenLng = parseFloat(body.green_lng ?? "");
  if (!isNaN(greenLat) && !isNaN(greenLng)) {
    geometry.green = { lat: greenLat, lng: greenLng };
  }

  // Parse hazards (hazard_name_0, hazard_lat_0, hazard_lng_0, ...)
  const hazards: Array<{ name: string; lat: number; lng: number }> = [];
  for (let i = 0; i < 20; i++) {
    const name = body[`hazard_name_${i}`];
    const lat = parseFloat(body[`hazard_lat_${i}`] ?? "");
    const lng = parseFloat(body[`hazard_lng_${i}`] ?? "");
    if (name && !isNaN(lat) && !isNaN(lng)) {
      hazards.push({ name, lat, lng });
    }
  }
  if (hazards.length > 0) geometry.hazards = hazards;

  // Parse layups (layup_name_0, layup_lat_0, layup_lng_0, ...)
  const layups: Array<{ name: string; lat: number; lng: number }> = [];
  for (let i = 0; i < 20; i++) {
    const name = body[`layup_name_${i}`];
    const lat = parseFloat(body[`layup_lat_${i}`] ?? "");
    const lng = parseFloat(body[`layup_lng_${i}`] ?? "");
    if (name && !isNaN(lat) && !isNaN(lng)) {
      layups.push({ name, lat, lng });
    }
  }
  if (layups.length > 0) geometry.layups = layups;

  return geometry;
}

function coursesListPage(courses: CourseWithCount[]): string {
  const rows = courses
    .map(
      (c) =>
        `<tr>
          <td><a href="/courses/${c.id}">${escapeHtml(c.name)}</a></td>
          <td>${escapeHtml(c.location)}</td>
          <td>${c.hole_count}</td>
        </tr>`
    )
    .join("");

  const body = `<h1>Courses</h1>
  <div class="actions">
    <a href="/courses/new" class="btn">Create course</a>
    <a href="/courses/import" class="btn">Import course</a>
  </div>
  ${
    courses.length === 0
      ? `<p class="empty">No courses yet.</p>`
      : `<div class="table-wrap"><table>
          <thead><tr><th>Name</th><th>Location</th><th>Holes</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`
  }`;
  return layout("Courses", body);
}

function newCoursePage(error?: string): string {
  const body = `<h1>New Course</h1>
  ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
  <div class="card">
    <form method="POST" action="/courses">
      <div class="form-group">
        <label for="name">Name</label>
        <input type="text" id="name" name="name" required>
      </div>
      <div class="form-group">
        <label for="location">Location</label>
        <input type="text" id="location" name="location">
      </div>
      <div class="form-actions">
        <button type="submit">Create Course</button>
      </div>
    </form>
  </div>`;
  return layout("New Course", body);
}

function courseDetailPage(course: CourseRow, holes: HoleRow[]): string {
  const holeRows = holes
    .map((h) => {
      const geo = JSON.parse(h.geometry) as HoleGeometry;
      return `<tr>
        <td>${h.hole_number}</td>
        <td>${h.par}</td>
        <td>${h.yardage}</td>
        <td>${geo.tee ? `${geo.tee.lat.toFixed(6)}, ${geo.tee.lng.toFixed(6)}` : "-"}</td>
        <td>${geo.green ? `${geo.green.lat.toFixed(6)}, ${geo.green.lng.toFixed(6)}` : "-"}</td>
        <td class="actions">
          <a href="/courses/${course.id}/holes/${h.id}/strategies">Strategies</a>
          <a href="/courses/${course.id}/holes/${h.id}/edit">Edit</a>
          <form method="POST" action="/courses/${course.id}/holes/${h.id}/delete">
            <button type="submit" class="btn btn-sm btn-danger">Delete</button>
          </form>
        </td>
      </tr>`;
    })
    .join("");

  const body = `<h1>${escapeHtml(course.name)}</h1>
  <p>${escapeHtml(course.location) || "No location set"}</p>
  <div class="actions">
    <a href="/courses/${course.id}/edit" class="btn">Edit course</a>
    <a href="/courses/${course.id}/holes/new" class="btn">Add hole</a>
    <form method="POST" action="/courses/${course.id}/delete">
      <button type="submit" class="btn btn-danger">Delete course</button>
    </form>
  </div>
  <h2>Holes</h2>
  ${
    holes.length === 0
      ? `<p class="empty">No holes yet. <a href="/courses/${course.id}/holes/new">Add one</a>.</p>`
      : `<div class="table-wrap"><table>
          <thead><tr><th>#</th><th>Par</th><th>Yards</th><th>Tee</th><th>Green</th><th>Actions</th></tr></thead>
          <tbody>${holeRows}</tbody>
        </table></div>`
  }`;
  return layout(course.name, body);
}

function editCoursePage(course: CourseRow, error?: string): string {
  const body = `<h1>Edit Course</h1>
  ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
  <div class="card">
    <form method="POST" action="/courses/${course.id}">
      <div class="form-group">
        <label for="name">Name</label>
        <input type="text" id="name" name="name" required value="${escapeHtml(course.name)}">
      </div>
      <div class="form-group">
        <label for="location">Location</label>
        <input type="text" id="location" name="location" value="${escapeHtml(course.location)}">
      </div>
      <div class="form-actions">
        <button type="submit">Save</button>
      </div>
    </form>
  </div>
  <p><a href="/courses/${course.id}">Back to course</a></p>`;
  return layout("Edit Course", body);
}

function newHolePage(course: CourseRow, error?: string): string {
  const body = `<h1>Add Hole to ${escapeHtml(course.name)}</h1>
  ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
  <div class="card">
    <form method="POST" action="/courses/${course.id}/holes">
      <div class="form-group">
        <label for="hole_number">Hole Number</label>
        <input type="number" id="hole_number" name="hole_number" required min="1">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="par">Par</label>
          <input type="number" id="par" name="par" required min="1" max="6">
        </div>
        <div class="form-group">
          <label for="yardage">Yardage</label>
          <input type="number" id="yardage" name="yardage" required min="1">
        </div>
      </div>
      <h3>Tee</h3>
      <div class="coord-row">
        <div class="form-group">
          <label for="tee_lat">Lat</label>
          <input type="text" id="tee_lat" name="tee_lat">
        </div>
        <div class="form-group">
          <label for="tee_lng">Lng</label>
          <input type="text" id="tee_lng" name="tee_lng">
        </div>
      </div>
      <h3>Green</h3>
      <div class="coord-row">
        <div class="form-group">
          <label for="green_lat">Lat</label>
          <input type="text" id="green_lat" name="green_lat">
        </div>
        <div class="form-group">
          <label for="green_lng">Lng</label>
          <input type="text" id="green_lng" name="green_lng">
        </div>
      </div>
      <h3>Hazards</h3>
      <div class="form-group">
        <label>Name</label>
        <input type="text" name="hazard_name_0">
      </div>
      <div class="coord-row">
        <div class="form-group">
          <label>Lat</label>
          <input type="text" name="hazard_lat_0">
        </div>
        <div class="form-group">
          <label>Lng</label>
          <input type="text" name="hazard_lng_0">
        </div>
      </div>
      <h3>Layups</h3>
      <div class="form-group">
        <label>Name</label>
        <input type="text" name="layup_name_0">
      </div>
      <div class="coord-row">
        <div class="form-group">
          <label>Lat</label>
          <input type="text" name="layup_lat_0">
        </div>
        <div class="form-group">
          <label>Lng</label>
          <input type="text" name="layup_lng_0">
        </div>
      </div>
      <div class="form-actions">
        <button type="submit">Add Hole</button>
      </div>
    </form>
  </div>
  <p><a href="/courses/${course.id}">Back to course</a></p>`;
  return layout("New Hole", body);
}

function editHolePage(course: CourseRow, hole: HoleRow, error?: string): string {
  const geo = JSON.parse(hole.geometry) as HoleGeometry;

  const hazardFields = (geo.hazards ?? [])
    .map(
      (h, i) => `<div class="shot-block">
        <div class="form-group">
          <label>Name</label>
          <input type="text" name="hazard_name_${i}" value="${escapeHtml(h.name)}">
        </div>
        <div class="coord-row">
          <div class="form-group">
            <label>Lat</label>
            <input type="text" name="hazard_lat_${i}" value="${h.lat}">
          </div>
          <div class="form-group">
            <label>Lng</label>
            <input type="text" name="hazard_lng_${i}" value="${h.lng}">
          </div>
        </div>
      </div>`
    )
    .join("");

  const layupFields = (geo.layups ?? [])
    .map(
      (l, i) => `<div class="shot-block">
        <div class="form-group">
          <label>Name</label>
          <input type="text" name="layup_name_${i}" value="${escapeHtml(l.name)}">
        </div>
        <div class="coord-row">
          <div class="form-group">
            <label>Lat</label>
            <input type="text" name="layup_lat_${i}" value="${l.lat}">
          </div>
          <div class="form-group">
            <label>Lng</label>
            <input type="text" name="layup_lng_${i}" value="${l.lng}">
          </div>
        </div>
      </div>`
    )
    .join("");

  const hazardSection = hazardFields || `<div class="shot-block">
    <div class="form-group">
      <label>Name</label>
      <input type="text" name="hazard_name_0">
    </div>
    <div class="coord-row">
      <div class="form-group">
        <label>Lat</label>
        <input type="text" name="hazard_lat_0">
      </div>
      <div class="form-group">
        <label>Lng</label>
        <input type="text" name="hazard_lng_0">
      </div>
    </div>
  </div>`;

  const layupSection = layupFields || `<div class="shot-block">
    <div class="form-group">
      <label>Name</label>
      <input type="text" name="layup_name_0">
    </div>
    <div class="coord-row">
      <div class="form-group">
        <label>Lat</label>
        <input type="text" name="layup_lat_0">
      </div>
      <div class="form-group">
        <label>Lng</label>
        <input type="text" name="layup_lng_0">
      </div>
    </div>
  </div>`;

  const body = `<h1>Edit Hole ${hole.hole_number} - ${escapeHtml(course.name)}</h1>
  ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
  <div class="card">
    <form method="POST" action="/courses/${course.id}/holes/${hole.id}">
      <div class="form-group">
        <label for="hole_number">Hole Number</label>
        <input type="number" id="hole_number" name="hole_number" required min="1" value="${hole.hole_number}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="par">Par</label>
          <input type="number" id="par" name="par" required min="1" max="6" value="${hole.par}">
        </div>
        <div class="form-group">
          <label for="yardage">Yardage</label>
          <input type="number" id="yardage" name="yardage" required min="1" value="${hole.yardage}">
        </div>
      </div>
      <h3>Tee</h3>
      <div class="coord-row">
        <div class="form-group">
          <label>Lat</label>
          <input type="text" name="tee_lat" value="${geo.tee?.lat ?? ""}">
        </div>
        <div class="form-group">
          <label>Lng</label>
          <input type="text" name="tee_lng" value="${geo.tee?.lng ?? ""}">
        </div>
      </div>
      <h3>Green</h3>
      <div class="coord-row">
        <div class="form-group">
          <label>Lat</label>
          <input type="text" name="green_lat" value="${geo.green?.lat ?? ""}">
        </div>
        <div class="form-group">
          <label>Lng</label>
          <input type="text" name="green_lng" value="${geo.green?.lng ?? ""}">
        </div>
      </div>
      <h3>Hazards</h3>
      ${hazardSection}
      <h3>Layups</h3>
      ${layupSection}
      <div class="form-actions">
        <button type="submit">Save Hole</button>
      </div>
    </form>
  </div>
  <p><a href="/courses/${course.id}">Back to course</a></p>`;
  return layout("Edit Hole", body);
}

function importPage(error?: string): string {
  const body = `<h1>Import Course</h1>
  ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
  <div class="card">
    <h2>Search OpenStreetMap</h2>
    <form method="GET" action="/courses/import/search">
      <div class="form-row">
        <div class="form-group">
          <input type="text" name="q" placeholder="Course name..." required>
        </div>
        <div class="form-group">
          <button type="submit">Search</button>
        </div>
      </div>
    </form>
  </div>
  <div class="card">
    <h2>Import from seed data (JSON)</h2>
    <p>Paste JSON in the format of <code>mearns_castle_geometry.json</code>:</p>
    <form method="POST" action="/courses/import-seed">
      <div class="form-group">
        <textarea name="json" rows="10" required></textarea>
      </div>
      <div class="form-actions">
        <button type="submit">Import</button>
      </div>
    </form>
  </div>
  <p><a href="/courses">Back to courses</a></p>`;
  return layout("Import Course", body);
}

function formatLocation(result: NominatimResult): string {
  const addr = result.address;
  if (!addr) return "";
  const parts = [addr.city ?? addr.town ?? addr.village, addr.county, addr.country].filter(Boolean);
  return parts.join(", ");
}

function searchResultsPage(query: string, results: NominatimResult[]): string {
  const resultsList = results
    .map((r) => {
      const location = formatLocation(r);
      const params = new URLSearchParams({
        osm_type: r.osm_type,
        osm_id: String(r.osm_id),
        name: r.display_name.split(",")[0],
        location,
        lat: r.lat,
        lon: r.lon,
      });
      return `<div class="search-result">
        <strong>${escapeHtml(r.display_name.split(",")[0])}</strong><br>
        <span class="card-meta">${escapeHtml(location)}</span><br>
        <a href="/courses/import/preview?${escapeHtml(params.toString())}">Preview &amp; Import</a>
      </div>`;
    })
    .join("");

  const body = `<h1>Search Results</h1>
  <p>Results for: <strong>${escapeHtml(query)}</strong></p>
  ${
    results.length === 0
      ? `<p class="empty">No results found. Try a different search term.</p>`
      : `<div class="card">${resultsList}</div>`
  }
  <p><a href="/courses/import">Back to import</a></p>`;
  return layout("Search Results", body);
}

function previewPage(
  course: ParsedCourse,
  osmType: string,
  osmId: number,
  lat?: string,
  lon?: string
): string {
  const holeRows = course.holes
    .map(
      (h) => `<tr>
        <td>${h.number}</td>
        <td>${h.par}</td>
        <td>${h.yardage}</td>
        <td>${h.tee ? `${h.tee.lat.toFixed(6)}, ${h.tee.lng.toFixed(6)}` : "-"}</td>
        <td>${h.green ? `${h.green.lat.toFixed(6)}, ${h.green.lng.toFixed(6)}` : "-"}</td>
      </tr>`
    )
    .join("");

  const holeSection =
    course.holes.length === 0
      ? "<p>No hole data found in OpenStreetMap. Course will be imported with name and location only.</p>"
      : `<div class="table-wrap"><table>
          <thead><tr><th>#</th><th>Par</th><th>Yards</th><th>Tee</th><th>Green</th></tr></thead>
          <tbody>${holeRows}</tbody>
        </table></div>`;

  const body = `<h1>Preview: ${escapeHtml(course.name)}</h1>
  <p>Location: ${escapeHtml(course.location) || "N/A"}</p>
  <p>Holes found: ${course.holes.length}</p>
  ${holeSection}
  <form method="POST" action="/courses/import/osm">
    <input type="hidden" name="osm_type" value="${escapeHtml(osmType)}">
    <input type="hidden" name="osm_id" value="${osmId}">
    <input type="hidden" name="name" value="${escapeHtml(course.name)}">
    <input type="hidden" name="location" value="${escapeHtml(course.location)}">
    ${lat ? `<input type="hidden" name="lat" value="${escapeHtml(lat)}">` : ""}
    ${lon ? `<input type="hidden" name="lon" value="${escapeHtml(lon)}">` : ""}
    <div class="form-actions">
      <button type="submit">Import this course</button>
    </div>
  </form>
  <p><a href="/courses/import">Back to search</a></p>
  <p class="osm-attribution">Data &copy; OpenStreetMap contributors</p>`;
  return layout("Preview Import", body);
}

function notFoundPage(message: string): string {
  const body = `<h1>Not Found</h1>
  <p>${escapeHtml(message)}</p>
  <p><a href="/courses">Back to courses</a></p>`;
  return layout("Not Found", body);
}
