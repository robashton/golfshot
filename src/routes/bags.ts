import { Router } from "express";
import type Database from "better-sqlite3";
import { requireAuth } from "../middleware/auth-guard.js";

interface BagRow {
  id: number;
  user_id: number;
  name: string;
  is_active: number;
  created_at: string;
}

interface BagWithClubCount extends BagRow {
  club_count: number;
}

interface ClubRow {
  id: number;
  bag_id: number;
  name: string;
  carry_yards: number;
}

interface SeedBagData {
  player?: string;
  stock_carries_yards: Record<string, number>;
  notes?: string[];
}

export function createBagsRouter(db: Database.Database): Router {
  const router = Router();

  // List user's bags
  router.get("/bags", requireAuth, (req, res) => {
    const bags = db
      .prepare(
        `SELECT b.*, COUNT(c.id) as club_count
         FROM bags b
         LEFT JOIN clubs c ON c.bag_id = b.id
         WHERE b.user_id = ?
         GROUP BY b.id
         ORDER BY b.is_active DESC, b.created_at DESC`
      )
      .all(req.session.userId!) as BagWithClubCount[];

    res.send(bagsListPage(bags));
  });

  // New bag form
  router.get("/bags/new", requireAuth, (_req, res) => {
    res.send(newBagPage());
  });

  // Import page
  router.get("/bags/import", requireAuth, (_req, res) => {
    res.send(importBagPage());
  });

  // Import bag from seed JSON
  router.post("/bags/import-seed", requireAuth, (req, res) => {
    const { json } = req.body as { json?: string };
    if (!json) {
      res.status(400).send(importBagPage("JSON data is required."));
      return;
    }

    let seedData: SeedBagData;
    try {
      seedData = JSON.parse(json) as SeedBagData;
    } catch {
      res.status(400).send(importBagPage("Invalid JSON format."));
      return;
    }

    if (!seedData.stock_carries_yards || typeof seedData.stock_carries_yards !== "object") {
      res.status(400).send(importBagPage('JSON must have a "stock_carries_yards" object.'));
      return;
    }

    const bagName = seedData.player ?? "Imported Bag";

    const insertBag = db.prepare(
      "INSERT INTO bags (user_id, name) VALUES (?, ?)"
    );
    const insertClub = db.prepare(
      "INSERT INTO clubs (bag_id, name, carry_yards) VALUES (?, ?, ?)"
    );

    const importAll = db.transaction(() => {
      const result = insertBag.run(req.session.userId!, bagName);
      const bagId = Number(result.lastInsertRowid);

      for (const [clubName, yards] of Object.entries(seedData.stock_carries_yards)) {
        if (typeof yards === "number") {
          insertClub.run(bagId, clubName, yards);
        }
      }

      return bagId;
    });

    const bagId = importAll();
    res.redirect(`/bags/${bagId}`);
  });

  // Create bag
  router.post("/bags", requireAuth, (req, res) => {
    const { name } = req.body as { name?: string };

    if (!name) {
      res.status(400).send(newBagPage("Bag name is required."));
      return;
    }

    const result = db
      .prepare("INSERT INTO bags (user_id, name) VALUES (?, ?)")
      .run(req.session.userId!, name);

    res.redirect(`/bags/${result.lastInsertRowid}`);
  });

  // View single bag
  router.get("/bags/:id", requireAuth, (req, res) => {
    const bag = db
      .prepare("SELECT * FROM bags WHERE id = ? AND user_id = ?")
      .get(req.params.id, req.session.userId!) as BagRow | undefined;

    if (!bag) {
      res.status(404).send(notFoundPage("Bag not found."));
      return;
    }

    const clubs = db
      .prepare("SELECT * FROM clubs WHERE bag_id = ? ORDER BY carry_yards DESC")
      .all(bag.id) as ClubRow[];

    res.send(bagDetailPage(bag, clubs));
  });

  // Edit bag form
  router.get("/bags/:id/edit", requireAuth, (req, res) => {
    const bag = db
      .prepare("SELECT * FROM bags WHERE id = ? AND user_id = ?")
      .get(req.params.id, req.session.userId!) as BagRow | undefined;

    if (!bag) {
      res.status(404).send(notFoundPage("Bag not found."));
      return;
    }

    const clubs = db
      .prepare("SELECT * FROM clubs WHERE bag_id = ? ORDER BY carry_yards DESC")
      .all(bag.id) as ClubRow[];

    res.send(editBagPage(bag, clubs));
  });

  // Update bag (name + clubs)
  router.post("/bags/:id", requireAuth, (req, res) => {
    const bag = db
      .prepare("SELECT * FROM bags WHERE id = ? AND user_id = ?")
      .get(req.params.id, req.session.userId!) as BagRow | undefined;

    if (!bag) {
      res.status(404).send(notFoundPage("Bag not found."));
      return;
    }

    const body = req.body as Record<string, string | undefined>;
    const name = body.name;

    if (!name) {
      const clubs = db
        .prepare("SELECT * FROM clubs WHERE bag_id = ? ORDER BY carry_yards DESC")
        .all(bag.id) as ClubRow[];
      res.status(400).send(editBagPage(bag, clubs, "Bag name is required."));
      return;
    }

    // Update bag name
    db.prepare("UPDATE bags SET name = ? WHERE id = ?").run(name, bag.id);

    // Replace all clubs: delete existing, re-insert from form
    const updateClubs = db.transaction(() => {
      db.prepare("DELETE FROM clubs WHERE bag_id = ?").run(bag.id);

      const insertClub = db.prepare(
        "INSERT INTO clubs (bag_id, name, carry_yards) VALUES (?, ?, ?)"
      );

      for (let i = 0; i < 30; i++) {
        const clubName = body[`club_name_${i}`];
        const carryYards = parseInt(body[`club_yards_${i}`] ?? "", 10);
        if (clubName && !isNaN(carryYards)) {
          insertClub.run(bag.id, clubName, carryYards);
        }
      }
    });

    updateClubs();

    res.redirect(`/bags/${bag.id}`);
  });

  // Delete bag
  router.post("/bags/:id/delete", requireAuth, (req, res) => {
    const bag = db
      .prepare("SELECT * FROM bags WHERE id = ? AND user_id = ?")
      .get(req.params.id, req.session.userId!) as BagRow | undefined;

    if (!bag) {
      res.status(404).send(notFoundPage("Bag not found."));
      return;
    }

    db.prepare("DELETE FROM bags WHERE id = ?").run(bag.id);
    res.redirect("/bags");
  });

  // Set bag as active
  router.post("/bags/:id/set-active", requireAuth, (req, res) => {
    const bag = db
      .prepare("SELECT * FROM bags WHERE id = ? AND user_id = ?")
      .get(req.params.id, req.session.userId!) as BagRow | undefined;

    if (!bag) {
      res.status(404).send(notFoundPage("Bag not found."));
      return;
    }

    const setActive = db.transaction(() => {
      // Deactivate all bags for this user
      db.prepare("UPDATE bags SET is_active = 0 WHERE user_id = ?").run(req.session.userId!);
      // Activate the selected bag
      db.prepare("UPDATE bags SET is_active = 1 WHERE id = ?").run(bag.id);
    });

    setActive();

    res.redirect(`/bags/${bag.id}`);
  });

  // Add club to bag
  router.post("/bags/:id/clubs", requireAuth, (req, res) => {
    const bag = db
      .prepare("SELECT * FROM bags WHERE id = ? AND user_id = ?")
      .get(req.params.id, req.session.userId!) as BagRow | undefined;

    if (!bag) {
      res.status(404).send(notFoundPage("Bag not found."));
      return;
    }

    const { club_name, carry_yards } = req.body as { club_name?: string; carry_yards?: string };
    const yards = parseInt(carry_yards ?? "", 10);

    if (!club_name || isNaN(yards)) {
      const clubs = db
        .prepare("SELECT * FROM clubs WHERE bag_id = ? ORDER BY carry_yards DESC")
        .all(bag.id) as ClubRow[];
      res.status(400).send(bagDetailPage(bag, clubs, "Club name and carry yardage are required."));
      return;
    }

    db.prepare("INSERT INTO clubs (bag_id, name, carry_yards) VALUES (?, ?, ?)").run(
      bag.id,
      club_name,
      yards
    );

    res.redirect(`/bags/${bag.id}`);
  });

  // Delete club
  router.post("/bags/:bagId/clubs/:clubId/delete", requireAuth, (req, res) => {
    const bag = db
      .prepare("SELECT * FROM bags WHERE id = ? AND user_id = ?")
      .get(req.params.bagId, req.session.userId!) as BagRow | undefined;

    if (!bag) {
      res.status(404).send(notFoundPage("Bag not found."));
      return;
    }

    db.prepare("DELETE FROM clubs WHERE id = ? AND bag_id = ?").run(
      req.params.clubId,
      bag.id
    );

    res.redirect(`/bags/${bag.id}`);
  });

  return router;
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

function bagsListPage(bags: BagWithClubCount[]): string {
  const rows = bags
    .map(
      (b) =>
        `<tr>
          <td><a href="/bags/${b.id}">${escapeHtml(b.name)}</a></td>
          <td>${b.club_count}</td>
          <td>${b.is_active ? "Active" : ""}</td>
        </tr>`
    )
    .join("");

  return `${pageHead("My Bags")}
  ${navBar()}
  <h1>My Bags</h1>
  <p><a href="/bags/new">Create bag</a> | <a href="/bags/import">Import bag</a></p>
  ${
    bags.length === 0
      ? "<p>No bags yet.</p>"
      : `<table>
          <thead><tr><th>Name</th><th>Clubs</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`
  }
</body></html>`;
}

function newBagPage(error?: string): string {
  return `${pageHead("New Bag")}
  ${navBar()}
  <h1>New Bag</h1>
  ${error ? `<p style="color:red">${escapeHtml(error)}</p>` : ""}
  <form method="POST" action="/bags">
    <label>Name: <input type="text" name="name" required></label><br>
    <button type="submit">Create Bag</button>
  </form>
</body></html>`;
}

function bagDetailPage(bag: BagRow, clubs: ClubRow[], error?: string): string {
  const clubRows = clubs
    .map(
      (c) =>
        `<tr>
          <td>${escapeHtml(c.name)}</td>
          <td>${c.carry_yards}</td>
          <td>
            <form method="POST" action="/bags/${bag.id}/clubs/${c.id}/delete" style="display:inline">
              <button type="submit">Remove</button>
            </form>
          </td>
        </tr>`
    )
    .join("");

  return `${pageHead(bag.name)}
  ${navBar()}
  <h1>${escapeHtml(bag.name)} ${bag.is_active ? "(Active)" : ""}</h1>
  ${error ? `<p style="color:red">${escapeHtml(error)}</p>` : ""}
  <p>
    <a href="/bags/${bag.id}/edit">Edit bag</a>
    ${!bag.is_active ? `| <form method="POST" action="/bags/${bag.id}/set-active" style="display:inline"><button type="submit">Set as active</button></form>` : ""}
  </p>
  <form method="POST" action="/bags/${bag.id}/delete" style="display:inline">
    <button type="submit">Delete bag</button>
  </form>
  <h2>Clubs</h2>
  ${
    clubs.length === 0
      ? "<p>No clubs yet.</p>"
      : `<table>
          <thead><tr><th>Club</th><th>Carry (yards)</th><th>Actions</th></tr></thead>
          <tbody>${clubRows}</tbody>
        </table>`
  }
  <h3>Add Club</h3>
  <form method="POST" action="/bags/${bag.id}/clubs">
    <label>Club: <input type="text" name="club_name" required placeholder="e.g. 7i, Driver"></label>
    <label>Carry (yards): <input type="number" name="carry_yards" required min="1"></label>
    <button type="submit">Add</button>
  </form>
  <p><a href="/bags">Back to bags</a></p>
</body></html>`;
}

function editBagPage(bag: BagRow, clubs: ClubRow[], error?: string): string {
  const clubFields = clubs
    .map(
      (c, i) =>
        `<div>
          <label>Club: <input type="text" name="club_name_${i}" value="${escapeHtml(c.name)}"></label>
          <label>Carry: <input type="number" name="club_yards_${i}" value="${c.carry_yards}" min="1"></label>
        </div>`
    )
    .join("");

  // Add one empty row for adding a new club
  const nextIndex = clubs.length;
  const emptyRow = `<div>
    <label>Club: <input type="text" name="club_name_${nextIndex}" placeholder="e.g. 7i"></label>
    <label>Carry: <input type="number" name="club_yards_${nextIndex}" min="1" placeholder="yards"></label>
  </div>`;

  return `${pageHead("Edit Bag")}
  ${navBar()}
  <h1>Edit Bag</h1>
  ${error ? `<p style="color:red">${escapeHtml(error)}</p>` : ""}
  <form method="POST" action="/bags/${bag.id}">
    <label>Name: <input type="text" name="name" required value="${escapeHtml(bag.name)}"></label><br>
    <h3>Clubs</h3>
    <p>Clear a club name to remove it on save.</p>
    ${clubFields}
    ${emptyRow}
    <br>
    <button type="submit">Save</button>
  </form>
  <p><a href="/bags/${bag.id}">Back to bag</a></p>
</body></html>`;
}

function importBagPage(error?: string): string {
  return `${pageHead("Import Bag")}
  ${navBar()}
  <h1>Import Bag</h1>
  ${error ? `<p style="color:red">${escapeHtml(error)}</p>` : ""}
  <p>Paste JSON in the format of <code>bag_profile.json</code>:</p>
  <form method="POST" action="/bags/import-seed">
    <textarea name="json" rows="15" cols="60" required></textarea><br>
    <button type="submit">Import</button>
  </form>
  <p><a href="/bags">Back to bags</a></p>
</body></html>`;
}

function notFoundPage(message: string): string {
  return `${pageHead("Not Found")}
  ${navBar()}
  <h1>Not Found</h1>
  <p>${escapeHtml(message)}</p>
  <p><a href="/bags">Back to bags</a></p>
</body></html>`;
}
