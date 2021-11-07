import crypto from 'crypto';
import validator from 'validator';

import * as db from './db';

import Debugger from 'debug';
const debug = Debugger('core:server:api');

import { Router } from 'express';
import { getPasswordHash } from './auth';
const router = Router();

/**
 * Add user to service
 */
router.post('/signup', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username)
        return res.status(400).send('missing username');
    if (!email)
        return res.status(400).send('missing email');
    if (!password)
        return res.status(400).send('missing password');

    // Validate username
    const un: string = username.toLowerCase();
    if (un.length > 100)
        return res.status(400).send('username must be less than 100 chars')
    if (un.match(/[^a-z0-9\-\_\~\.]/))
        return res.status(400).send('username includes invalid characters');
    if (!validator.isEmail(email))
        return res.status(500).send('invalid email');

    // Verify no duplicate username
    const dupUsername = await db.queryProm('SELECT 1 FROM Users WHERE username = ?', [un], true);
    if (dupUsername instanceof Error)
        return res.status(500).send(dupUsername);
    if (dupUsername.length) {
        debug("duplicate username: %s", un);
        return res.status(400).send(`username '${un}' is already taken`);
    }

    // Check if email is already used
    const dupEmail = await db.queryProm("SELECT 1 FROM Users WHERE email=?", [ email ], true);
    if (dupEmail instanceof Error)
        return res.status(500).send(dupEmail);
    if (dupEmail.length) {
        debug("duplicate email: %s", req.body.email);
        return res.status(400).send(`email '${req.body.email}' already in use, log in instead`);
    }

    // Add user to db
    let userId: string;
    for (;;) {
        userId = String(Math.ceil(Math.random() * Number.MAX_SAFE_INTEGER));
        const pwHash = getPasswordHash(userId, password);
        const result = await db.queryProm(
            'INSERT INTO Users (userId, email, username, hashedPassword, createdTs) VALUES (?, ?, ?, ?, ?);',
            [userId, email, un, pwHash, Date.now()],
            false,
        );

        if (result instanceof Error) {
            if (result.message.match(/Duplicate entry '.+' for key 'PRIMARY'/))
                continue;
            return res.status(500).send(result);
        }
        break;
    }

    res.send(un);
});

export default router;