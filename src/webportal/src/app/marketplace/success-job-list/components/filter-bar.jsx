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

import React, { useContext, useCallback } from 'react';
import {
  getTheme,
  ColorClassNames,
  SearchBox,
  Stack,
  FontWeights,
} from 'office-ui-fabric-react';
import { isNil, isEmpty } from 'lodash';

import Context from '../Context';
import Filter from '../Filter';

const FilterBar = () => {
  const { spacing } = getTheme();

  const { filteredJobs, setFilter } = useContext(Context);

  const changeKeyword = useCallback(keyword => {
    setFilter(new Filter(keyword));
  });

  return (
    <Stack>
      <Stack
        horizontal
        verticalAlign='stretch'
        horizontalAlign='space-between'
        styles={{
          root: [
            ColorClassNames.neutralLightBackground,
            {
              marginTop: spacing.s2,
              padding: spacing.m,
            },
          ],
        }}
      >
        <SearchBox
          underlined={true}
          placeholder='Search'
          styles={{
            root: {
              fontSize: 14,
              fontWeight: FontWeights.regular,
            },
          }}
          onChange={changeKeyword}
        />
      </Stack>
      {!isNil(filteredJobs) && !isEmpty(filteredJobs) && (
        <Stack
          padding={spacing.s2}
          styles={{
            root: {
              fontSize: 14,
              fontWeight: FontWeights.regular,
            },
          }}
        >
          {filteredJobs.length} results
        </Stack>
      )}
    </Stack>
  );
};

export default FilterBar;
