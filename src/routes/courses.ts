import { Router } from "express";
import type Database from "better-sqlite3";
import { requireAuth } from "../middleware/auth-guard.js";

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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pageHead(title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(title)} - Golfshot</title></head>
<body>`;
}

function navBar(): string {
  return `<nav><a href="/dashboard">Dashboard</a> | <a href="/courses">Courses</a> | <a href="/bags">My Bags</a></nav><hr>`;
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

  return `${pageHead("Courses")}
  ${navBar()}
  <h1>Courses</h1>
  <p><a href="/courses/new">Create course</a> | <a href="/courses/import">Import course</a></p>
  ${
    courses.length === 0
      ? "<p>No courses yet.</p>"
      : `<table>
          <thead><tr><th>Name</th><th>Location</th><th>Holes</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`
  }
</body></html>`;
}

function newCoursePage(error?: string): string {
  return `${pageHead("New Course")}
  ${navBar()}
  <h1>New Course</h1>
  ${error ? `<p style="color:red">${escapeHtml(error)}</p>` : ""}
  <form method="POST" action="/courses">
    <label>Name: <input type="text" name="name" required></label><br>
    <label>Location: <input type="text" name="location"></label><br>
    <button type="submit">Create Course</button>
  </form>
</body></html>`;
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
        <td>
          <a href="/courses/${course.id}/holes/${h.id}/edit">Edit</a>
          <form method="POST" action="/courses/${course.id}/holes/${h.id}/delete" style="display:inline">
            <button type="submit">Delete</button>
          </form>
        </td>
      </tr>`;
    })
    .join("");

  return `${pageHead(course.name)}
  ${navBar()}
  <h1>${escapeHtml(course.name)}</h1>
  <p>Location: ${escapeHtml(course.location) || "N/A"}</p>
  <p>
    <a href="/courses/${course.id}/edit">Edit course</a> |
    <a href="/courses/${course.id}/holes/new">Add hole</a>
  </p>
  <form method="POST" action="/courses/${course.id}/delete" style="display:inline">
    <button type="submit">Delete course</button>
  </form>
  <h2>Holes</h2>
  ${
    holes.length === 0
      ? "<p>No holes yet. <a href=\"/courses/" + course.id + "/holes/new\">Add one</a>.</p>"
      : `<table>
          <thead><tr><th>#</th><th>Par</th><th>Yards</th><th>Tee</th><th>Green</th><th>Actions</th></tr></thead>
          <tbody>${holeRows}</tbody>
        </table>`
  }
</body></html>`;
}

function editCoursePage(course: CourseRow, error?: string): string {
  return `${pageHead("Edit Course")}
  ${navBar()}
  <h1>Edit Course</h1>
  ${error ? `<p style="color:red">${escapeHtml(error)}</p>` : ""}
  <form method="POST" action="/courses/${course.id}">
    <label>Name: <input type="text" name="name" required value="${escapeHtml(course.name)}"></label><br>
    <label>Location: <input type="text" name="location" value="${escapeHtml(course.location)}"></label><br>
    <button type="submit">Save</button>
  </form>
  <p><a href="/courses/${course.id}">Back to course</a></p>
</body></html>`;
}

function newHolePage(course: CourseRow, error?: string): string {
  return `${pageHead("New Hole")}
  ${navBar()}
  <h1>Add Hole to ${escapeHtml(course.name)}</h1>
  ${error ? `<p style="color:red">${escapeHtml(error)}</p>` : ""}
  <form method="POST" action="/courses/${course.id}/holes">
    <label>Hole Number: <input type="number" name="hole_number" required min="1"></label><br>
    <label>Par: <input type="number" name="par" required min="1" max="6"></label><br>
    <label>Yardage: <input type="number" name="yardage" required min="1"></label><br>
    <h3>Tee</h3>
    <label>Lat: <input type="text" name="tee_lat"></label>
    <label>Lng: <input type="text" name="tee_lng"></label><br>
    <h3>Green</h3>
    <label>Lat: <input type="text" name="green_lat"></label>
    <label>Lng: <input type="text" name="green_lng"></label><br>
    <h3>Hazards</h3>
    <div>
      <label>Name: <input type="text" name="hazard_name_0"></label>
      <label>Lat: <input type="text" name="hazard_lat_0"></label>
      <label>Lng: <input type="text" name="hazard_lng_0"></label>
    </div>
    <h3>Layups</h3>
    <div>
      <label>Name: <input type="text" name="layup_name_0"></label>
      <label>Lat: <input type="text" name="layup_lat_0"></label>
      <label>Lng: <input type="text" name="layup_lng_0"></label>
    </div>
    <br>
    <button type="submit">Add Hole</button>
  </form>
  <p><a href="/courses/${course.id}">Back to course</a></p>
</body></html>`;
}

function editHolePage(course: CourseRow, hole: HoleRow, error?: string): string {
  const geo = JSON.parse(hole.geometry) as HoleGeometry;

  const hazardFields = (geo.hazards ?? [])
    .map(
      (h, i) => `<div>
        <label>Name: <input type="text" name="hazard_name_${i}" value="${escapeHtml(h.name)}"></label>
        <label>Lat: <input type="text" name="hazard_lat_${i}" value="${h.lat}"></label>
        <label>Lng: <input type="text" name="hazard_lng_${i}" value="${h.lng}"></label>
      </div>`
    )
    .join("");

  const layupFields = (geo.layups ?? [])
    .map(
      (l, i) => `<div>
        <label>Name: <input type="text" name="layup_name_${i}" value="${escapeHtml(l.name)}"></label>
        <label>Lat: <input type="text" name="layup_lat_${i}" value="${l.lat}"></label>
        <label>Lng: <input type="text" name="layup_lng_${i}" value="${l.lng}"></label>
      </div>`
    )
    .join("");

  // Add one empty row for hazards/layups if none exist
  const hazardSection = hazardFields || `<div>
    <label>Name: <input type="text" name="hazard_name_0"></label>
    <label>Lat: <input type="text" name="hazard_lat_0"></label>
    <label>Lng: <input type="text" name="hazard_lng_0"></label>
  </div>`;

  const layupSection = layupFields || `<div>
    <label>Name: <input type="text" name="layup_name_0"></label>
    <label>Lat: <input type="text" name="layup_lat_0"></label>
    <label>Lng: <input type="text" name="layup_lng_0"></label>
  </div>`;

  return `${pageHead("Edit Hole")}
  ${navBar()}
  <h1>Edit Hole ${hole.hole_number} - ${escapeHtml(course.name)}</h1>
  ${error ? `<p style="color:red">${escapeHtml(error)}</p>` : ""}
  <form method="POST" action="/courses/${course.id}/holes/${hole.id}">
    <label>Hole Number: <input type="number" name="hole_number" required min="1" value="${hole.hole_number}"></label><br>
    <label>Par: <input type="number" name="par" required min="1" max="6" value="${hole.par}"></label><br>
    <label>Yardage: <input type="number" name="yardage" required min="1" value="${hole.yardage}"></label><br>
    <h3>Tee</h3>
    <label>Lat: <input type="text" name="tee_lat" value="${geo.tee?.lat ?? ""}"></label>
    <label>Lng: <input type="text" name="tee_lng" value="${geo.tee?.lng ?? ""}"></label><br>
    <h3>Green</h3>
    <label>Lat: <input type="text" name="green_lat" value="${geo.green?.lat ?? ""}"></label>
    <label>Lng: <input type="text" name="green_lng" value="${geo.green?.lng ?? ""}"></label><br>
    <h3>Hazards</h3>
    ${hazardSection}
    <h3>Layups</h3>
    ${layupSection}
    <br>
    <button type="submit">Save Hole</button>
  </form>
  <p><a href="/courses/${course.id}">Back to course</a></p>
</body></html>`;
}

function importPage(error?: string): string {
  return `${pageHead("Import Course")}
  ${navBar()}
  <h1>Import Course</h1>
  ${error ? `<p style="color:red">${escapeHtml(error)}</p>` : ""}
  <h2>Import from seed data (JSON)</h2>
  <p>Paste JSON in the format of <code>mearns_castle_geometry.json</code>:</p>
  <form method="POST" action="/courses/import-seed">
    <textarea name="json" rows="15" cols="60" required></textarea><br>
    <button type="submit">Import</button>
  </form>
  <hr>
  <h2>Import from Open Data</h2>
  <p>Coming soon: import courses from OpenStreetMap and golf course APIs.</p>
  <p><a href="/courses">Back to courses</a></p>
</body></html>`;
}

function notFoundPage(message: string): string {
  return `${pageHead("Not Found")}
  ${navBar()}
  <h1>Not Found</h1>
  <p>${escapeHtml(message)}</p>
  <p><a href="/courses">Back to courses</a></p>
</body></html>`;
}
