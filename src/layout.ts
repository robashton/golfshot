export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function layout(title: string, body: string, nav = true): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Golfshot</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  ${nav ? navBar() : ""}
  <main class="container">
    ${body}
  </main>
</body>
</html>`;
}

function navBar(): string {
  return `<nav class="nav">
  <div class="nav-inner">
    <a href="/dashboard" class="nav-brand">Golfshot</a>
    <div class="nav-links">
      <a href="/dashboard">Dashboard</a>
      <a href="/courses">Courses</a>
      <a href="/bags">Bags</a>
    </div>
    <form method="POST" action="/logout" class="nav-logout">
      <button type="submit" class="btn btn-sm btn-outline">Logout</button>
    </form>
  </div>
</nav>`;
}
