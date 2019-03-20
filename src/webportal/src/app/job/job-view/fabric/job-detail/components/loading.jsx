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

import {FontClassNames} from '@uifabric/styling';
import c from 'classnames';
import {Spinner, SpinnerSize} from 'office-ui-fabric-react/lib/Spinner';
import React from 'react';

import t from '../../tachyons.css';

import loadingGif from '../../../../../../assets/img/loading.gif';

export const Loading = () => (
  <div className={c(t.absolute, t.top0, t.left0, t.w100, t.h100, t.bgWhite30)}>
    <div className={c(t.flex, t.itemsCenter, t.justifyCenter, t.h100)}>
      <img className={t.o50} src={loadingGif} />
    </div>
  </div>
);

export const SpinnerLoading = () => (
  <div className={c(t.absolute, t.top0, t.left0, t.w100, t.h100, t.bgWhite30)}>
    <div className={c(t.flex, t.itemsCenter, t.justifyCenter, t.h100)}>
      <div className={c(t.flex, t.itemsCenter)}>
        <Spinner size={SpinnerSize.large} />
        <div className={c(t.ml4, FontClassNames.xLarge)}>Loading...</div>
      </div>
    </div>
  </div>
);
