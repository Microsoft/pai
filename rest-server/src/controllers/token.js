// Copyright (c) Microsoft Corporation
// All rights reserved.
//
// MIT License
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
// documentation files (the "Software"), to deal in the Software without restriction, including without limitation
// the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
// to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
// BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// module dependencies
const jwt = require('jsonwebtoken');
const httpStatus = require('http-status');
const tokenConfig = require('../config/token');
const tokenModel = require('../models/token');

/**
 * Get the token.
 */
const get = (req, res, next) => {
  const username = req.body.username;
  const password = req.body.password;
  const expiration = req.body.expiration;
  tokenModel.check(username, password, (err, state, admin) => {
    if (err || !state) {
      const error = err || new Error('authentication failed');
      error.status = httpStatus.UNAUTHORIZED;
      next(error);
    } else {
      jwt.sign({
        username: username,
        admin: admin,
      }, tokenConfig.secret, {expiresIn: expiration}, (signError, token) => {
        if (signError) {
          signError.status = httpStatus.INTERNAL_SERVER_ERROR;
          signError.message = 'sign token failed';
          next(signError);
        }
        return res.status(httpStatus.OK).json({
          user: username,
          token: token,
          admin: admin,
        });
      });
    }
  });
};

// module exports
module.exports = {get};
