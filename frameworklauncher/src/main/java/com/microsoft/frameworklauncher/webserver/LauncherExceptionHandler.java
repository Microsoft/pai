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

package com.microsoft.frameworklauncher.webserver;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.google.inject.Singleton;
import com.microsoft.frameworklauncher.common.WebCommon;
import com.microsoft.frameworklauncher.common.exceptions.BadRequestException;
import com.microsoft.frameworklauncher.common.exceptions.NotFoundException;
import com.microsoft.frameworklauncher.common.exceptions.ThrottledRequestException;
import com.microsoft.frameworklauncher.utils.DefaultLogger;
import org.apache.hadoop.util.StringUtils;
import org.apache.hadoop.yarn.webapp.RemoteExceptionData;
import org.apache.http.HttpStatus;

import javax.servlet.http.HttpServletResponse;
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.Response;
import javax.ws.rs.ext.ExceptionMapper;
import javax.ws.rs.ext.Provider;

@Singleton
@Provider
public class LauncherExceptionHandler implements ExceptionMapper<Exception> {
  private static final DefaultLogger LOGGER = new DefaultLogger(StatusManager.class);

  private @Context
  HttpServletResponse response;

  @Override
  public Response toResponse(Exception e) {
    // Don't catch this as filter forward on 404
    // (ServletContainer.FEATURE_FILTER_FORWARD_ON_404)
    // won't work and the web UI won't work!
    if (e instanceof com.sun.jersey.api.NotFoundException) {
      return ((com.sun.jersey.api.NotFoundException) e).getResponse();
    }
    // clear content type
    response.setContentType(null);

    // Map response status
    String logPrefix = "Http request failed due to: ";
    final int statusCode;
    if (e instanceof NotFoundException) {
      LOGGER.logInfo(e, logPrefix + "Not Found");
      statusCode = HttpStatus.SC_NOT_FOUND;
    } else if (e instanceof BadRequestException ||
        e instanceof JsonProcessingException ||
        e instanceof WebApplicationException) {
      LOGGER.logInfo(e, logPrefix + "Bad Request");
      statusCode = HttpStatus.SC_BAD_REQUEST;
    } else if (e instanceof ThrottledRequestException) {
      LOGGER.logInfo(e, logPrefix + "Throttled Request");
      statusCode = WebCommon.SC_TOO_MANY_REQUESTS;
    } else {
      LOGGER.logWarning(e, logPrefix + "Service Unavailable");
      statusCode = HttpStatus.SC_SERVICE_UNAVAILABLE;
    }

    // let jaxb handle marshalling data out in the same format requested
    RemoteExceptionData exception = new RemoteExceptionData(
        e.getClass().getSimpleName(),
        StringUtils.stringifyException(e),
        e.getClass().getName());

    return Response.status(statusCode).entity(exception)
        .build();
  }
}
