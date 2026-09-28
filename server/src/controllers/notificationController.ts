import { Request, Response, NextFunction } from 'express';
import { notificationService } from '../services/notificationService';
import { getAuthUser } from '../middleware/requireAuth';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const IATA_PATTERN = /^[A-Z0-9]{3}$/;
const MAX_TRACKING_DAY_OFFSET = 3;

function notFound(res: Response, what: string): void {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `${what} not found.` } });
}

export class NotificationController {
  /**
   * GET /api/notifications
   * Re-checks the user's due tracked flights, then returns their notifications.
   */
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = getAuthUser(res);
      await notificationService.refreshUser(user.id);
      const notifications = notificationService.listNotifications(user.id);
      res.json({
        success: true,
        data: {
          notifications,
          unreadCount: notifications.filter((n) => !n.read).length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /** PATCH /api/notifications/:id/read */
  public static async markRead(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(res);
    if (!notificationService.markRead(user.id, req.params.id)) return notFound(res, 'Notification');
    res.json({ success: true });
  }

  /** PATCH /api/notifications/read-all */
  public static async markAllRead(req: Request, res: Response): Promise<void> {
    notificationService.markAllRead(getAuthUser(res).id);
    res.json({ success: true });
  }

  /** DELETE /api/notifications/:id */
  public static async remove(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(res);
    if (!notificationService.deleteNotification(user.id, req.params.id)) return notFound(res, 'Notification');
    res.json({ success: true });
  }

  /** GET /api/tracked-flights */
  public static async listTracked(req: Request, res: Response): Promise<void> {
    res.json({ success: true, data: notificationService.listTracked(getAuthUser(res).id) });
  }

  /**
   * POST /api/tracked-flights
   * Body: { flightNumber, flightDate (YYYY-MM-DD), depIata, arrIata }
   */
  public static async track(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { flightNumber, flightDate, depIata, arrIata } = req.body || {};
      const input = {
        flightNumber: String(flightNumber || '').trim().toUpperCase(),
        flightDate: String(flightDate || '').trim(),
        depIata: String(depIata || '').trim().toUpperCase(),
        arrIata: String(arrIata || '').trim().toUpperCase(),
      };

      if (!/^[A-Z0-9]{2,8}$/.test(input.flightNumber) || !DATE_PATTERN.test(input.flightDate) ||
          !IATA_PATTERN.test(input.depIata) || !IATA_PATTERN.test(input.arrIata)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'flightNumber, flightDate (YYYY-MM-DD), depIata and arrIata are required.',
          },
        });
        return;
      }

      // AirLabs schedules only cover flights around today; rejecting other
      // dates up front avoids spending a provider call on a certain miss.
      const dayOffset = Math.abs(Date.parse(`${input.flightDate}T00:00:00Z`) - Date.parse(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')) / 86_400_000;
      if (!(dayOffset <= MAX_TRACKING_DAY_OFFSET)) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Only flights departing within a few days of today can be tracked.' },
        });
        return;
      }

      const { tracked, created } = await notificationService.track(getAuthUser(res).id, input);
      res.status(created ? 201 : 200).json({ success: true, data: tracked });
    } catch (error) {
      next(error);
    }
  }

  /** DELETE /api/tracked-flights/:id */
  public static async untrack(req: Request, res: Response): Promise<void> {
    const user = getAuthUser(res);
    if (!notificationService.untrack(user.id, req.params.id)) return notFound(res, 'Tracked flight');
    res.json({ success: true });
  }
}
