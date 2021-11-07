import crypto from 'crypto';
import validator from 'validator';

import * as db from './db';

import Debugger from 'debug';
const debug = Debugger('core:server:api');

import { Router } from 'express';
import { getPasswordHash } from './auth';
const router = Router();

/**
 * @param code user-provided referral code
 * @returns
 *      - Error if query failed
 *      - true if code is valid and active
 *      - false if valid and inactive (expired)
 *      - null if code doesn't exist
 */
async function checkReferralCode(code: string): Promise<boolean | Error | null> {
    const res = await db.queryProm('SELECT active FROM ReferralCodes WHERE code = ?', [code], true);
    if (res instanceof Error)
        return res;
    if (res.length == 0)
        return null;
    return !!(res[0] as any).active
}

/**
 * Verify referral code
 */
router.get('/refcode/check/:code', async (req, res) => {
    // TODO rate-limit this endpoint
    const check = await checkReferralCode(req.params.code);
    if (check instanceof Error)
        return res.status(500).send(check);
    res.send({
        true: 'valid',
        false: 'expired',
        null: 'invalid',
    }[JSON.stringify(check)]);
});

/**
 * Add user to service
 */
router.post('/signup', async (req, res) => {
    const { username, email, password, refcode } = req.body;
    if (!username)
        return res.status(400).send('missing username');
    if (!email)
        return res.status(400).send('missing email');
    if (!password)
        return res.status(400).send('missing password');
    if (!refcode)
        return res.status(400).send('invalid referral code');

    // Check Referral code
    const rcValid = await checkReferralCode(refcode);
    if (rcValid instanceof Error)
        return res.status(500).send(rcValid);
    if (!rcValid)
        return res.status(400).send('invalid referral code');

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

    // On success send user their new username
    res.send(un);

    // TODO generate user page
});

export default router;