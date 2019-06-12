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
import PropTypes from 'prop-types';
import {Pivot, PivotItem, Icon, ActionButton, Stack} from 'office-ui-fabric-react';
import {getFormClassNames, getTabFromStyle} from './form-style';

const TAB_ITEM_KEY_PREFIX = 'tabItem-';
const tabFormStyle = getTabFromStyle();

export class TabForm extends React.Component {
  constructor(props) {
    super(props);
    const {defaultItems} = props;

    let selectedIndex;
    if (defaultItems !== undefined && defaultItems.size !== 0) {
      selectedIndex = 0;
    }

    this.state = {
      selectedIndex: selectedIndex,
      items: defaultItems,
    };
  }

  _getItemKeyByIndex(index) {
    return TAB_ITEM_KEY_PREFIX + index;
  }

  _getItemIndexByKey(key) {
    return Number(key.substring(TAB_ITEM_KEY_PREFIX.length));
  }

  _getContentItems(items) {
    const {onRenderTabContent} = this.props;
    return items.map((item, index) => {
      const {headerText, content} = item;
      return {
        headerText: headerText,
        content: onRenderTabContent(index, content, this._onContentChange.bind(this, index)),
        itemKey: this._getItemKeyByIndex(index),
      };
    });
  }

  _renderPivotItems(items) {
    const pivotItems = items.map((items) =>
                         <PivotItem key={items.itemKey}
                                    itemKey={items.itemKey}
                                    headerText={items.headerText}
                                    onRenderItemLink={this._onRenderItem.bind(this)}/>);

    return pivotItems;
  }

  _onRenderItem(itemPros, defaultRender) {
    if (itemPros === undefined || defaultRender === undefined) {
      return null;
    }

    return (
    <span>
      { defaultRender(itemPros) }
      <Icon iconName="Cancel"
            styles={ tabFormStyle.tabIcon }
            onClick={this._onItemDelete.bind(this, itemPros.itemKey)} />
    </span>);
  }

  _onItemsChange(updatedItems) {
    const {onItemsChange} = this.props;
    if (onItemsChange !== undefined) {
      onItemsChange(updatedItems);
    }
  }

  _onItemDelete(itemKey, event) {
    event.stopPropagation();

    if (itemKey === undefined) {
      return;
    }

    const itemIndex = this._getItemIndexByKey(itemKey);
    const {items} = this.state;
    const updatedItems = items.filter((_, index) => index !== itemIndex);

    // TODO: use other policy to update index
    const newSelectedIndex = 0;

    this._onItemsChange(updatedItems);
    this.setState({
      items: updatedItems,
      selectedIndex: newSelectedIndex,
    });
  }

  _onAddItem() {
    const {items} = this.state;
    const {createContentFunc, headerTextPrefix} = this.props;
    const updatedItems = [...items, {headerText: `${headerTextPrefix} ${items.length + 1}`, content: createContentFunc()}];
    const newSelectedIndex = updatedItems.length - 1;

    this._onItemsChange(updatedItems);
    this.setState({
      selectedIndex: newSelectedIndex,
      items: updatedItems,
    });
  }

  _onLinkClick(item) {
    this.setState({
      selectedIndex: this._getItemIndexByKey(item.props.itemKey),
    });
  }

  _onContentChange(index, itemContent) {
    const {items} = this.state;
    const updatedItems = [...items];
    updatedItems[index].content = itemContent;

    this._onItemsChange(updatedItems);
    this.setState({
      items: updatedItems,
    });
  }

  render() {
    let {selectedIndex, items} = this.state;

    const {formTabBar} = getFormClassNames();
    const contentItems = this._getContentItems(items);
    const pivotItems = this._renderPivotItems(contentItems);

    if (selectedIndex === undefined && items.length) {
      selectedIndex = 0;
    }

    return (
      <>
        <Stack className={formTabBar} horizontal>
          <Stack.Item styles={tabFormStyle.tabWapper}>
            <Pivot onLinkClick={this._onLinkClick.bind(this)}
                   styles={{text: tabFormStyle.tab.text, root: tabFormStyle.tab.root}}
                   selectedKey={this._getItemKeyByIndex(selectedIndex)}>
             {pivotItems}
            </Pivot>
          </Stack.Item>
          <Stack.Item disableShrink>
            <ActionButton iconProps={{iconName: 'CircleAddition'}} text='Add new task role' onClick={this._onAddItem.bind(this)}/>
          </Stack.Item>
        </Stack>
        <Stack styles={tabFormStyle.tabContent}>
          {selectedIndex !== undefined ? contentItems[selectedIndex].content: null}
        </Stack>
      </>
    );
  }
}

TabForm.propTypes = {
  defaultItems: PropTypes.array.isRequired,
  headerTextPrefix: PropTypes.string.isRequired,
  createContentFunc: PropTypes.func.isRequired,
  onRenderTabContent: PropTypes.func.isRequired,
  onItemsChange: PropTypes.func,
};
