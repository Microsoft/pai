/*
 * Copyright (c) Microsoft Corporation
 * All rights reserved.
 *
 * MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import React from 'react';
import {BasicSection} from './BasicSection';
import PropTypes from 'prop-types';
import {CSpinButton} from './CustomizedComponents';

export const FormSpinButton = (props) => {
  const {sectionLabel, sectionOptional, onChange, value} = props;
  const _onChange = (value) => {
    if (onChange !== undefined) {
      onChange(value);
    }
  };

  return (
    <BasicSection sectionLabel={sectionLabel} sectionOptional={sectionOptional}>
      <CSpinButton {...props}
                   min={0}
                   step={1}
                   value={value === undefined ? NaN.toString(): value}
                   onChange={_onChange}/>
    </BasicSection>
  );
};

FormSpinButton.propTypes = {
  sectionLabel: PropTypes.string.isRequired,
  sectionOptional: PropTypes.bool,
  onChange: PropTypes.func,
  value: PropTypes.number,
};
