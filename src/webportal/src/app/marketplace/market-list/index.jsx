/*
 * Copyright (c) Microsoft Corporation
 * All rights reserved.
 *
 * MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the 'Software'), to deal
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
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import 'whatwg-fetch';

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { initializeIcons, Fabric, Stack } from 'office-ui-fabric-react';
import { getTheme } from '@uifabric/styling';
import { isNil } from 'lodash';

import { initTheme } from '../../components/theme';
import { TopBar } from './components/top-bar';
import { CategorySideBar } from './components/category-side-bar';
import { FilterBar } from './components/filter-bar';
import { ItemList } from './components/item-list';
import { MarketItem } from '../models/market-item';
import { fetchMarketItemList } from './utils/conn';
import Context from './Context';
import Filter from './Filter';
import Paginator from './components/paginator';
import Pagination from './Pagination';

initTheme();
initializeIcons();

const MarketList = () => {
  const [itemList, setItemList] = useState(null);
  const [filteredItems, setFilteredItems] = useState(null);
  const [filter, setFilter] = useState(new Filter());
  const [pagination, setPagination] = useState(new Pagination());

  useEffect(() => {
    setFilteredItems(filter.apply(itemList));
  }, [itemList, filter]);

  useEffect(() => {
    setPagination(new Pagination(pagination.itemsPerPage, 0));
  }, [filteredItems]);

  useEffect(() => {
    reload();
  }, []);

  async function reload() {
    const nextState = {
      loading: false,
      reloading: false,
      error: null,
      itemList: [],
    };

    var allItems = [];
    const loadMarketItemList = async () => {
      try {
        allItems = await fetchMarketItemList();
      } catch (err) {
        alert(err.message);
        window.location.href('home.html');
      }
    };

    await loadMarketItemList();

    allItems.forEach(function(item) {
      // parse tags
      if (item.tags !== null && item.tags !== '') {
        item.tags = item.tags.split('|');
      } else {
        item.tags = [];
      }
      const marketItem = new MarketItem(
        item.id,
        item.name,
        item.author,
        item.createDate,
        item.updateDate,
        item.category,
        item.tags,
        item.introduction,
        item.description,
        item.jobConfig,
        item.submits,
        item.stars,
      );
      nextState.itemList.push(marketItem);
    });

    setItemList(nextState.itemList);
  }

  const context = {
    itemList,
    filteredItems, // used in <ItemList>
    filter, // changed in <SearchBox>
    setFilter, // used in <SearchBox>
    pagination,
    setPagination,
  };

  return (
    <Context.Provider value={context}>
      <Fabric style={{ height: '100%', margin: '0 auto', maxWidth: 1200 }}>
        <Stack padding='l1' gap='l1'>
          <TopBar />
          <Stack horizontal gap='l2'>
            <CategorySideBar />
            <Stack.Item grow>
              <Stack gap='s' styles={{ root: [{ minWidth: 0 }] }}>
                <FilterBar />
                <ItemList />
              </Stack>
              {!isNil(filteredItems) && filteredItems.length !== 0 && (
                <Paginator />
              )}
            </Stack.Item>
          </Stack>
        </Stack>
      </Fabric>
    </Context.Provider>
  );
};

const contentWrapper = document.getElementById('content-wrapper');

document.getElementById('sidebar-menu--marketplace').classList.add('active');
ReactDOM.render(<MarketList />, contentWrapper);
