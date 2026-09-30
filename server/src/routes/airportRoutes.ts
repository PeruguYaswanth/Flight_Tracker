import { Router } from 'express';
import { AirportController } from '../controllers/airportController';

const router = Router();

router.get('/', AirportController.listAirports);
// Registered before '/:code' so "search"/"resolve" are never taken as codes.
router.get('/search', AirportController.searchAirports);
router.get('/resolve', AirportController.resolveAirport);
router.get('/:code', AirportController.getAirportDetails);

export default router;
