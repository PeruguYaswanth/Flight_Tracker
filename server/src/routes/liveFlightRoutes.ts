import { Router, Request, Response, NextFunction } from 'express';
import { LiveFlightController } from '../controllers/liveFlightController';

const router = Router();

// Live positions must never be served from a browser/proxy cache (or
// revalidated to a 304): every poll re-evaluates the provider state.
router.use((req: Request, res: Response, next: NextFunction) => {
  // Without these, Express answers a matching ETag with 304 Not Modified.
  delete req.headers['if-none-match'];
  delete req.headers['if-modified-since'];
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  next();
});

router.get('/:flightNumber', LiveFlightController.getLivePosition);

export default router;
