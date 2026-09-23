import { Router } from 'express';
import { AirportController } from '../controllers/airportController';

const router = Router();

router.get('/', AirportController.listAirports);
router.get('/:code', AirportController.getAirportDetails);

export default router;
