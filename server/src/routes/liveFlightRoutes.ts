import { Router } from 'express';
import { LiveFlightController } from '../controllers/liveFlightController';

const router = Router();

router.get('/:flightNumber', LiveFlightController.getLivePosition);

export default router;
