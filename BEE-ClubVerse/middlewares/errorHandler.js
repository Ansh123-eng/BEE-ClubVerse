import { logger } from './logger.js';

const errorHandler = (err, req, res, next) => {
    
    logger.error('--- ERROR HANDLER ---', {
        time: new Date().toISOString(),
        request: `${req.method} ${req.originalUrl}`,
        status: err.status || 500,
        message: err.message,
        stack: err.stack
    });

    const status = err.status && Number.isInteger(err.status) ? err.status : 500;

    res.status(status).json({
        error: 'Something went wrong!',
        message: err.message || 'Internal Server Error',
        status,
        path: req.originalUrl,
        timestamp: new Date().toISOString(),
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};

export default errorHandler;
