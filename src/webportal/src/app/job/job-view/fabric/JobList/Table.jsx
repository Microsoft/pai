import React, {useContext, useMemo} from 'react';

import {DefaultButton} from 'office-ui-fabric-react/lib/Button';
import {Link} from 'office-ui-fabric-react/lib/Link';
import {ColumnActionsMode, Selection} from 'office-ui-fabric-react/lib/DetailsList';
import {MessageBar, MessageBarType} from 'office-ui-fabric-react/lib/MessageBar';
import {ShimmeredDetailsList} from 'office-ui-fabric-react/lib/ShimmeredDetailsList';
import {FontClassNames} from 'office-ui-fabric-react/lib/Styling';

import {DateTime, Duration} from 'luxon';

import {getModified, getDuration, getStatusText} from './utils';
import Context from './Context';
import Ordering from './Ordering';

const zeroPaddingRowFieldStyle = {
  marginTop: -11,
  marginBottom: -11,
  marginLeft: -12,
  marginRight: -8,
};

export default function Table() {
  const {allJobs, stopJob, filteredJobs, setSelectedJobs, filter, ordering, setOrdering, pagination} = useContext(Context);

  /**
   * @type {import('office-ui-fabric-react').Selection}
   */
  const selection = useMemo(() => {
    return new Selection({
      onSelectionChanged() {
        setSelectedJobs(selection.getSelection());
      },
    });
  }, []);

  /**
   * @param {React.MouseEvent<HTMLElement>} event
   * @param {import('office-ui-fabric-react').IColumn} column
   */
  function onColumnClick(event, column) {
    const {field, descending} = ordering;
    if (field === column.key) {
      if (descending) {
        setOrdering(new Ordering());
      } else {
        setOrdering(new Ordering(field, true));
      }
    } else {
      setOrdering(new Ordering(column.key));
    }
  }

  /**
   * @param {import('office-ui-fabric-react').IColumn} column
   */
  function applySortProps(column) {
    column.isSorted = ordering.field === column.key;
    column.isSortedDescending = ordering.descending;
    column.onColumnClick = onColumnClick;
    return column;
  }

  const nameColumn = applySortProps({
    key: 'name',
    minWidth: 200,
    name: 'Name',
    fieldName: 'name',
    className: FontClassNames.mediumPlus,
    headerClassName: FontClassNames.medium,
    isResizable: true,
    isFiltered: filter.keyword !== '',
    onRender(job) {
      const {legacy, name, namespace, username} = job;
      const href = legacy
        ? `/job-detail.html?jobName=${name}`
        : `/job-detail.html?username=${namespace || username}&jobName=${name}`;
      return <Link href={href}>{name}</Link>;
    },
  });
  const modifiedColumn = applySortProps({
    key: 'modified',
    minWidth: 150,
    name: 'Date Modified',
    className: FontClassNames.mediumPlus,
    headerClassName: FontClassNames.medium,
    isResizable: true,
    isSorted: ordering.field === 'modified',
    isSortedDescending: !ordering.descending,
    onRender(job) {
      return DateTime.fromJSDate(getModified(job)).toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS);
    },
  });
  const userColumn = applySortProps({
    key: 'user',
    minWidth: 100,
    name: 'User',
    fieldName: 'username',
    className: FontClassNames.mediumPlus,
    headerClassName: FontClassNames.medium,
    isResizable: true,
    isFiltered: filter.users.size > 0,
  });
  const durationColumn = applySortProps({
    key: 'duration',
    minWidth: 60,
    name: 'Duration',
    className: FontClassNames.mediumPlus,
    headerClassName: FontClassNames.medium,
    isResizable: true,
    onRender(job) {
      return Duration.fromMillis(getDuration(job)).toFormat(`h:mm:ss`);
    },
  });
  const virtualClusterColumn = applySortProps({
    key: 'virtualCluster',
    minWidth: 100,
    name: 'Virtual Cluster',
    fieldName: 'virtualCluster',
    className: FontClassNames.mediumPlus,
    headerClassName: FontClassNames.medium,
    isResizable: true,
    isFiltered: filter.virtualClusters.size > 0,
  });
  const retriesColumn = applySortProps({
    key: 'retries',
    minWidth: 60,
    name: 'Retries',
    fieldName: 'retries',
    className: FontClassNames.mediumPlus,
    headerClassName: FontClassNames.medium,
    isResizable: true,
  });
  const statusColumn = applySortProps({
    key: 'status',
    minWidth: 100,
    name: 'Status',
    headerClassName: FontClassNames.medium,
    isResizable: true,
    isFiltered: filter.statuses.size > 0,
    onRender(job) {
      /** @type {React.CSSProperties} */
      const wrapperStyle = {display: 'inline-block', verticalAlign: 'middle', width: '100%'};
      const statusText = getStatusText(job);
      /** @type {MessageBarType} */
      const messageBarType = {
        Waiting: MessageBarType.warning,
        Running: MessageBarType.success,
        Stopping: MessageBarType.severeWarning,
        Succeeded: MessageBarType.success,
        Failed: MessageBarType.remove,
        Stopped: MessageBarType.blocked,
      }[statusText];
      const rootStyle = {
        backgroundColor: {
          Waiting: '#FCD116',
          Running: '#0071BC',
          Stopping: '#0071BC',
          Succeeded: '#7FBA00',
          Failed: '#E81123',
          Stopped: '#B1B5B8',
        }[statusText],
      };
      /** @type {import('@uifabric/styling').IStyle} */
      const iconContainerStyle = {marginTop: 8, marginBottom: 8, marginLeft: 8};
      /** @type {import('@uifabric/styling').IStyle} */
      const iconStyle = {color: 'white'};
      /** @type {import('@uifabric/styling').IStyle} */
      const textStyle = {marginTop: 8, marginRight: 8, marginBottom: 8, color: 'white'};
      return (
        <div style={Object.assign(wrapperStyle, zeroPaddingRowFieldStyle)}>
          <MessageBar
            messageBarType={messageBarType}
            styles={{root: rootStyle, iconContainer: iconContainerStyle, icon: iconStyle, text: textStyle}}
          >
            {statusText}
          </MessageBar>
        </div>
      );
    },
  });

  /**
   * @type {import('office-ui-fabric-react').IColumn}
   */
  const actionsColumn = {
    key: 'actions',
    minWidth: 100,
    name: 'Actions',
    headerClassName: FontClassNames.medium,
    columnActionsMode: ColumnActionsMode.disabled,
    onRender(job) {
      /**
       * @param {React.MouseEvent} event
       */
      function onClick(event) {
        event.stopPropagation();
        stopJob(job);
      }
      /** @type {React.CSSProperties} */
      const wrapperStyle = {display: 'inline-block', verticalAlign: 'middle', width: '100%'};

      const statusText = getStatusText(job);
      const disabled = statusText !== 'Waiting' && statusText !== 'Running';
      return (
        <div style={Object.assign(wrapperStyle, zeroPaddingRowFieldStyle)} data-selection-disabled>
          <DefaultButton
            iconProps={{iconName: 'StopSolid'}}
            disabled={disabled}
            onClick={onClick}
          >
            Stop
          </DefaultButton>
        </div>
      );
    },
  };

  const columns = [
    nameColumn,
    modifiedColumn,
    userColumn,
    durationColumn,
    virtualClusterColumn,
    retriesColumn,
    statusColumn,
    actionsColumn,
  ];

  return (
    <ShimmeredDetailsList
      items={pagination.apply(ordering.apply(filteredJobs || []))}
      setKey="key"
      columns={columns}
      enableShimmer={allJobs === null}
      shimmerLines={pagination.itemsPerPage}
      selection={selection}
    />
  );
}
