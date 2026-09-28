import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.use(requireAuth);

router.get('/', NotificationController.list);
// Registered before '/:id/read' so "read-all" is never taken as an id.
router.patch('/read-all', NotificationController.markAllRead);
router.patch('/:id/read', NotificationController.markRead);
router.delete('/:id', NotificationController.remove);

export default router;
