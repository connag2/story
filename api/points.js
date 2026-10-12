// GET /api/points  → { points, solved, bonus, spent, owned, admin }   (로그인 필요)
import { authUser, handle, json } from "./_lib.js";
import { isAdmin, loadPoints, pointsView } from "./_points.js";

export function GET(req) {
  return handle(async () => {
    const { id, rec } = await authUser(req);
    return json({ ...pointsView(await loadPoints(id)), admin: isAdmin(rec.name) });
  });
}
