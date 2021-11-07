// Load dotenv
import { config } from 'dotenv';
config();

// Connect to database
import * as db from './db';
db.begin();

// Initialize debugger
import Debugger from 'debug';
const debug = Debugger('core:server');

// Set up express server
import express from 'express';
import {json} from 'body-parser';
const app = express();
app.use(json());
app.set('trust proxy', 1);

// Add routes
// Add static data
// TODO use reverse proxy instead
app.use(express.static('./static'));

// These will contain the content for the different user pages
app.use(express.static('./pages'));

// Route api endpoints
import apiRouter from './api';
app.use('/api/', apiRouter);


// Start sever
const port = Number(process.env.PORT) || 8080;
app.listen(port, () => debug(`Now listening on port ${port}`));