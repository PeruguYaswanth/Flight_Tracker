import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.use(requireAuth);

router.get('/', NotificationController.listTracked);
router.post('/', NotificationController.track);
router.delete('/:id', NotificationController.untrack);

export default router;
