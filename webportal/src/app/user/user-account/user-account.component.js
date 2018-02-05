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
const breadcrumbComponent = require('../../job/breadcrumb/breadcrumb.component.ejs');
const userAccountComponent = require('./user-account.component.ejs');
const webportalConfig = require('../../config/webportal.config.json');
const userAuth = require('../user-auth/user-auth.component');
require('./user-account.component.scss');


const userAccountHtml = userAccountComponent({
  breadcrumb: breadcrumbComponent
});

$('#content-wrapper').html(userAccountHtml);
$(document).ready(() => {
  $('#form-change-password').on('submit', (e) => {
    e.preventDefault();
    const username = cookies.get('user');
    const password = $('#form-change-password :input[name=password]').val();
    const admin = userAuth.checkAdmin();
    userAuth.checkToken((token) => {
      $.ajax({
        url: `${webportalConfig.restServerUri}/api/v1/user`,
        data: {
          username,
          password,
          admin: admin,
          modify: true
        },
        type: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`
        },
        dataType: 'json',
        success: (data) => {
          $('#form-change-password').trigger('reset');
          if (data.error) {
            alert(data.message);
          } else {
            alert('Change password successfully');
          }
        },
        error: (xhr, textStatus, error) => {
          $('#form-change-password').trigger('reset');
          const res = JSON.parse(xhr.responseText);
          alert(res.message);
        }
      });
    });
  });
});

const userAccount = () => {
  cookies.remove('user');
  cookies.remove('token');
  cookies.remove('admin');
  window.location.replace('/login.html');
};

module.exports = { userAccount };