import { Router } from 'express';
import { FlightController } from '../controllers/flightController';

const router = Router();

// Route searches
router.get('/route', FlightController.searchByRoute);

// General search (by flight number, airline, date, airport)
router.get('/search', FlightController.searchFlights);

// Single flight details
router.get('/:flightNumber', FlightController.getFlightDetails);

export default router;
