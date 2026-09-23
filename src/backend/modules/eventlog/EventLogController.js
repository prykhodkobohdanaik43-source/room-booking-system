const MAX_LIMIT = 200;

// ФВ-22: перегляд журналу для адміністратора офісу; імена беремо з модуля Users через його сервіс
export class EventLogController {
  constructor(eventLogService, userService) {
    this.eventLogService = eventLogService;
    this.userService = userService;
  }

  recent = async (req, res) => {
    const requested = Number.parseInt(req.query.limit ?? '', 10);
    const limit = Number.isNaN(requested) ? 50 : Math.min(Math.max(requested, 1), MAX_LIMIT);

    const [entries, users] = await Promise.all([this.eventLogService.recent(limit), this.userService.list()]);
    const names = new Map(users.map((user) => [user.id, user.fullName]));
    res.json(
      entries.map((entry) => ({
        id: entry.id,
        timestamp: entry.timestamp,
        actionType: entry.actionType,
        bySystem: entry.bySystem,
        actorName: entry.bySystem ? 'система' : (names.get(entry.actorId) ?? null),
        details: entry.details,
      })),
    );
  };
}
