const requestMetrics = {
    totalRequests: 0,
    totalErrors: 0,
    totalResponseTimeMs: 0,
    bytesIn: 0,
    bytesOut: 0,
};

export function getRequestMetrics() {
    return {
        ...requestMetrics,
        averageResponseTimeMs: requestMetrics.totalRequests > 0
            ? requestMetrics.totalResponseTimeMs / requestMetrics.totalRequests
            : 0,
        errorRatePercent: requestMetrics.totalRequests > 0
            ? (requestMetrics.totalErrors / requestMetrics.totalRequests) * 100
            : 0,
    };
}

const logger = function (req, res, next) {
    console.log(`method: ${req.method}, url: ${req.url}, date: ${new Date()}`);

    const startedAt = Date.now();
    const contentLength = Number(req.headers['content-length'] || 0);
    if (contentLength > 0) {
        requestMetrics.bytesIn += contentLength;
    }

    res.on('finish', () => {
        const duration = Date.now() - startedAt;
        requestMetrics.totalRequests += 1;
        requestMetrics.totalResponseTimeMs += duration;

        const responseLengthHeader = res.getHeader('content-length');
        if (responseLengthHeader) {
            requestMetrics.bytesOut += Number(responseLengthHeader);
        }

        if (res.statusCode >= 400) {
            requestMetrics.totalErrors += 1;
        }
    });

    next();
};

export default logger;