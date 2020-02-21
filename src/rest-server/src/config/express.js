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
const fs = require('fs');
const cors = require('cors');
const yaml = require('js-yaml');
const morgan = require('morgan');
const express = require('express');
const compress = require('compression');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const config = require('@pai/config');
const logger = require('@pai/config/logger');
const authnConfig = require('@pai/config/authn');
const querystring = require('querystring');
const createError = require('@pai/utils/error');
const routers = {
  v1: require('@pai/routes/index'),
  v2: require('@pai/routes/v2/index'),
};

const app = express();

app.set('json spaces', config.env === 'development' ? 4 : 0);

app.use(cors());
app.use(compress());
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(bodyParser.text({type: 'text/*'}));
app.use(cookieParser());

// setup the logger for requests
app.use(morgan('dev', {'stream': logger.stream}));

// mount all v1 APIs to /api/v1
app.use('/api/v1', routers.v1);

// mount all v2 APIs to /api/v2
app.use('/api/v2', routers.v2);

// create OpenAPI docs
const swaggerSpec = yaml.safeLoad(fs.readFileSync('./docs/swagger.yaml'));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError('Not Found', 'NoApiError', `API ${req.url} is not found.`));
});

if (authnConfig.authnMethod === 'OIDC') {
  // error handler for /api/v1/authn/oidc/return
  app.use('/api/v1/authn/oidc/return', function (err, req, res, next) {
    logger.warn(err);
    let qsData = {
      errorMessage: err.message,
    };
    let redirectURI = err.targetURI ? err.targetURI : process.env.WEBPORTAL_URL;
    redirectURI = redirectURI + '?' + querystring.stringify(qsData);
    return res.redirect(redirectURI);
  });
}

// error handler
app.use((err, req, res, next) => {
  logger.warn(err.stack);
  res.status(err.status || 500).json({
    code: err.code,
    message: err.message,
    stack: config.env === 'development' ? err.stack.split('\n') : void 0,
  });
});

// module exports
module.exports = app;
