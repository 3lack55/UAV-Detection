import { InfluxDB, Point } from '@influxdata/influxdb-client';
import dotenv from 'dotenv';

dotenv.config();

export  const influxClient = new InfluxDB({
    url: process.env.INFLUX_URL || 'http://localhost:8086',
    token: process.env.INFLUX_TOKEN || 'my-token'
});

export const BUCKET = process.env.INFLUX_BUCKET || 'my-bucket';
export const ORG = process.env.INFLUX_ORG || 'my-org';
export { Point };
