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
const express = require('express');
const authConfig = require('../config/auth');
const authController = require('../controllers/auth');
const param = require('../middlewares/parameter');


const router = express.Router();

router.route('/token')
    /** POST /api/v1/auth/token - Return token if username and password is correct */
    .post(param.validate(authConfig.schema), authController.getToken);

router.route('/user')
    /** POST /api/v1/auth/user - Create / update a user */
    .post(authConfig.check, param.validate(authConfig.authConfigSchema), authController.updateUser)

    /** DELETE /api/v1/auth/user - Remove a user */
    .delete(authConfig.check, authController.removeUser);

// module exports
module.exports = router;